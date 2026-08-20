/**
 * Port de functions/src/codigos.ts — 8 handlers (AD-8 transaccional INTACTO).
 * HttpsError → APIError mecánico; rate-limits in-memory de consultarCodigoDirecto
 * → registry + rateLimit.ts (Firestore transaccional); validarToken NO tenía
 * rate-limit en v2 y ahora lo aplica el registry (REQ-AS-004).
 */

import { v4 as uuidv4 } from 'uuid';
import { APIError } from './errors.js';
import { getDb } from './firebase.js';
import * as admin from 'firebase-admin';
import { buscarCodigoVerificacion } from './imap.js';
import type { AuthedReq } from './registry.js';

const db = getDb();

const TOKEN_MAX_USES = 10;
const DEFAULT_TOKEN_EXPIRY_DAYS = 30;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 5; // max 5 requests per token per minute

function dataOf(req: AuthedReq): Record<string, unknown> {
  return (req.data ?? {}) as Record<string, unknown>;
}

export async function generarToken(req: AuthedReq): Promise<unknown> {
  if (!req.auth) {
    throw new APIError('unauthenticated', 'Debes iniciar sesión');
  }

  const uid = req.auth.uid;

  // Validar que el usuario existe en la colección usuarios
  const userDoc = await db.collection('usuarios').doc(uid).get();
  if (!userDoc.exists) {
    throw new APIError('permission-denied', 'Usuario no encontrado');
  }

  // Verificar suscripción Enterprise
  const suscripcionSnapshot = await db.collection('suscripciones').get();
  const suscripcionActiva = suscripcionSnapshot.docs
    .map(d => d.data() as any)
    .find(s => s.usuarioId === uid && s.estado === 'activa');

  if (!suscripcionActiva) {
    throw new APIError(
      'permission-denied',
      'Se requiere plan Enterprise para generar tokens'
    );
  }

  const plan = (suscripcionActiva.planNombre as string)?.toLowerCase() || '';
  if (!plan.includes('enterprise')) {
    throw new APIError(
      'permission-denied',
      'Se requiere plan Enterprise para generar tokens'
    );
  }

  const { cuentaId, perfilNombre, clienteId, clienteNombre, expiraEn } = dataOf(req);

  if (!cuentaId || !perfilNombre || !clienteId || !clienteNombre) {
    throw new APIError(
      'invalid-argument',
      'Faltan campos requeridos: cuentaId, perfilNombre, clienteId, clienteNombre'
    );
  }

  const cuentaDoc = await db.collection('cuentas').doc(cuentaId as string).get();
  if (!cuentaDoc.exists) {
    throw new APIError(
      'not-found',
      'La cuenta especificada no existe'
    );
  }

  const cuenta = cuentaDoc.data()!;
  if (cuenta.propietarioId !== uid) {
    throw new APIError(
      'permission-denied',
      'No tienes permisos sobre esta cuenta'
    );
  }

  const token = uuidv4();
  const ahora = admin.firestore.FieldValue.serverTimestamp();
  const expiraEnDate = expiraEn
    ? expiraEn as string
    : new Date(Date.now() + DEFAULT_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db.collection('tokens').doc(token).set({
    token,
    cuentaId,
    perfilNombre,
    clienteId,
    clienteNombre,
    vendedorId: uid,
    expiraEn: expiraEnDate,
    activo: true,
    useCount: 0,
    createdAt: ahora,
  });

  return {
    token,
    url: `/r/${token}`,
  };
}

export async function validarToken(req: AuthedReq): Promise<unknown> {
  const { token } = dataOf(req);
  if (!token || typeof token !== 'string') {
    throw new APIError(
      'invalid-argument',
      'Token es requerido'
    );
  }

  const tokenDoc = await db.collection('tokens').doc(token).get();
  if (!tokenDoc.exists) {
    return { valido: false, error: 'Token no encontrado' };
  }

  const tokenData = tokenDoc.data()!;

  if (!tokenData.activo) {
    return { valido: false, error: 'Token revocado — contacta a tu vendedor' };
  }

  const expiraEn = new Date(tokenData.expiraEn as string);
  if (expiraEn < new Date()) {
    return { valido: false, error: 'Token expirado' };
  }

  const cuentaDoc = await db.collection('cuentas').doc(tokenData.cuentaId as string).get();
  const proveedor = cuentaDoc.exists ? (cuentaDoc.data()!.proveedor as string) : '';

  const casosDisponibles = getCasosPorProveedor(proveedor).filter(c => c !== 'resetnet');

  return {
    valido: true,
    cuentaId: tokenData.cuentaId,
    proveedor,
    perfiles: [tokenData.perfilNombre],
    expiraEn: tokenData.expiraEn,
    casos: casosDisponibles,
  };
}

export async function consultarCodigo(req: AuthedReq): Promise<unknown> {
  const { token, caso } = dataOf(req);

  if (!token || !caso) {
    throw new APIError(
      'invalid-argument',
      'Token y caso son requeridos'
    );
  }

  const tokenDoc = await db.collection('tokens').doc(token as string).get();
  if (!tokenDoc.exists) {
    throw new APIError(
      'not-found',
      'Token no encontrado'
    );
  }

  const tokenData = tokenDoc.data()!;

  if (!tokenData.activo) {
    throw new APIError(
      'permission-denied',
      'Token revocado — contacta a tu vendedor'
    );
  }

  const expiraEn = new Date(tokenData.expiraEn as string);
  if (expiraEn < new Date()) {
    throw new APIError(
      'permission-denied',
      'Token expirado'
    );
  }

  // ── Rate-limit transaccional (AD-8): cuenta INTENTOS, antes del IMAP ──
  // Check + increment atómicos: sin ventana de carrera entre lectura y escritura.
  const tokenRef = db.collection('tokens').doc(token as string);
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(tokenRef);
    if (!doc.exists) {
      throw new APIError('not-found', 'Token no encontrado');
    }
    const data = doc.data()!;
    const now = Date.now();
    const rateLimit = data.rateLimit || { count: 0, windowStart: now };

    // Ventana vencida → reiniciar contador
    if (now - (rateLimit.windowStart as number) >= RATE_LIMIT_WINDOW) {
      rateLimit.count = 0;
      rateLimit.windowStart = now;
    }

    if ((rateLimit.count as number) >= MAX_REQUESTS) {
      throw new APIError(
        'resource-exhausted',
        'Demasiadas consultas. Intenta de nuevo en unos minutos.'
      );
    }

    transaction.update(tokenRef, {
      rateLimit: { count: (rateLimit.count as number) + 1, windowStart: rateLimit.windowStart },
    });
  });

  const currentUses = (tokenData.useCount as number) || 0;
  if (currentUses >= TOKEN_MAX_USES) {
    throw new APIError(
      'resource-exhausted',
      'Límite de consultas alcanzado para este token'
    );
  }

  const cuentaId = tokenData.cuentaId as string;

  const cuentaDoc = await db.collection('cuentas').doc(cuentaId).get();
  if (!cuentaDoc.exists) {
    throw new APIError(
      'not-found',
      'Cuenta no encontrada'
    );
  }

  const cuentaData = cuentaDoc.data()!;
  const servicio = cuentaData.proveedor as string;

  const result = await consultarCodigoIMAP(cuentaId, servicio, caso as string, {
    auth: 'Error de autenticación IMAP — verifica las credenciales de la cuenta',
  });

  if (!result) {
    return {
      encontrado: false,
      mensaje: 'Código no encontrado — verifica que el código haya sido enviado al correo',
    };
  }

  // Incrementar contador de usos solo en consultas exitosas (no transaccional)
  await db.collection('tokens').doc(token as string).update({
    useCount: admin.firestore.FieldValue.increment(1),
  });

  return {
    encontrado: true,
    codigo: result.codigo,
    email: result.correo,
    fecha: result.fecha,
    tipo: caso,
  };
}

function getCasosPorProveedor(proveedor: string): string[] {
  const map: Record<string, string[]> = {
    Netflix: ['viajenet', 'hogarnet', 'resetnet', 'ininet'],
    Win: ['wincode'],
    ChatGPT: ['cgptcode'],
    'Universal+': ['univer1'],
    Max: ['accmax'],
  };
  return map[proveedor] || [];
}

function getDefaultIMAPHost(proveedorIMAP: string): string {
  const hosts: Record<string, string> = {
    gmail: 'imap.gmail.com',
    outlook: 'outlook.office365.com',
  };
  return hosts[proveedorIMAP] || 'imap.gmail.com';
}

/**
 * Helper compartido entre consultarCodigo y consultarCodigoDirecto.
 * Busca credenciales IMAP, configura la conexión y ejecuta la búsqueda.
 */
async function consultarCodigoIMAP(
  cuentaId: string,
  servicio: string,
  caso: string,
  errorMsgs?: { notFound?: string; auth?: string }
): Promise<{ codigo: string; correo: string; fecha: string; tipo: string } | null> {
  const secretosDoc = await db.collection('cuentas_secretos').doc(cuentaId).get();
  if (!secretosDoc.exists) {
    throw new APIError('not-found', errorMsgs?.notFound || 'Credenciales de cuenta no encontradas');
  }

  const secretos = secretosDoc.data()!;
  const imapConfig = {
    correo: secretos.correo as string,
    contrasena: secretos.contrasena as string,
    host: (secretos.imapHost as string) || getDefaultIMAPHost(secretos.proveedorIMAP as string),
    port: (secretos.imapPort as number) || 993,
  };

  try {
    const result = await buscarCodigoVerificacion(imapConfig, servicio, caso);
    if (!result) return null;
    return {
      codigo: result.codigo,
      correo: imapConfig.correo,
      fecha: result.fecha,
      tipo: caso,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`Error en IMAP para cuenta ${cuentaId}:`, message);

    if (message.includes('Connection timeout') || message.includes('connect')) {
      throw new APIError('unavailable', 'No se pudo conectar al correo de la cuenta');
    }
    if (message.includes('authentication') || message.includes('auth')) {
      throw new APIError('permission-denied', errorMsgs?.auth || 'Error de autenticación IMAP');
    }

    throw new APIError('internal', 'Error al consultar el código');
  }
}

export async function guardarCredenciales(req: AuthedReq): Promise<unknown> {
  if (!req.auth) {
    throw new APIError(
      'unauthenticated',
      'Debes iniciar sesión'
    );
  }

  const uid = req.auth.uid;
  const { cuentaId, correo, contrasena, imapHost, imapPort, proveedorIMAP } = dataOf(req);

  if (!cuentaId || !correo || !contrasena) {
    throw new APIError(
      'invalid-argument',
      'Faltan campos requeridos: cuentaId, correo, contrasena'
    );
  }

  // Verificar que la cuenta existe y pertenece al usuario
  const cuentaDoc = await db.collection('cuentas').doc(cuentaId as string).get();
  if (!cuentaDoc.exists) {
    throw new APIError(
      'not-found',
      'La cuenta especificada no existe'
    );
  }

  const cuenta = cuentaDoc.data()!;
  if (cuenta.propietarioId !== uid) {
    throw new APIError(
      'permission-denied',
      'No tienes permisos sobre esta cuenta'
    );
  }

  // Guardar credenciales en cuentas_secretos (solo accesible por Admin SDK)
  await db.collection('cuentas_secretos').doc(cuentaId as string).set({
    cuentaId,
    correo,
    contrasena,
    imapHost: imapHost || 'imap.gmail.com',
    imapPort: imapPort || 993,
    proveedorIMAP: proveedorIMAP || 'gmail',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true, cuentaId };
}

export async function toggleToken(req: AuthedReq): Promise<unknown> {
  if (!req.auth) {
    throw new APIError('unauthenticated', 'Debes iniciar sesión');
  }

  const uid = req.auth.uid;
  const { tokenId, activo } = dataOf(req);

  if (!tokenId) {
    throw new APIError('invalid-argument', 'tokenId es requerido');
  }

  if (typeof activo !== 'boolean') {
    throw new APIError('invalid-argument', 'activo debe ser booleano');
  }

  const tokenDoc = await db.collection('tokens').doc(tokenId as string).get();
  if (!tokenDoc.exists) {
    throw new APIError('not-found', 'Token no encontrado');
  }

  const tokenData = tokenDoc.data()!;
  if (tokenData.vendedorId !== uid) {
    throw new APIError('permission-denied', 'No tienes permisos sobre este token');
  }

  await db.collection('tokens').doc(tokenId as string).update({
    activo,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, activo };
}

// Rate limiting movido a registry + rateLimit.ts (Firestore transaccional, AD-4):
// uid:{uid} 10/60s y cuenta:{cuentaId} 5/60s. CERO maps in-memory (REQ-RL-003).

export async function consultarCodigoDirecto(req: AuthedReq): Promise<unknown> {
  if (!req.auth) {
    throw new APIError('unauthenticated', 'Debes iniciar sesión');
  }

  const uid = req.auth.uid;
  const { cuentaId, caso } = dataOf(req);

  if (!cuentaId || !caso) {
    throw new APIError('invalid-argument', 'cuentaId y caso son requeridos');
  }

  // Verificar que la cuenta existe y pertenece al usuario
  const cuentaDoc = await db.collection('cuentas').doc(cuentaId as string).get();
  if (!cuentaDoc.exists) {
    throw new APIError('not-found', 'Cuenta no encontrada');
  }

  const cuentaData = cuentaDoc.data()!;
  if (cuentaData.propietarioId !== uid) {
    throw new APIError('permission-denied', 'No tienes permisos sobre esta cuenta');
  }

  const servicio = cuentaData.proveedor as string;

  const result = await consultarCodigoIMAP(cuentaId as string, servicio, caso as string, {
    notFound: 'Credenciales IMAP no configuradas',
    auth: 'Error de autenticación IMAP',
  });

  if (!result) {
    return {
      encontrado: false,
      mensaje: 'Código no encontrado — verifica que el código haya sido enviado al correo',
    };
  }

  return {
    encontrado: true,
    codigo: result.codigo,
    email: result.correo,
    fecha: result.fecha,
    tipo: caso,
  };
}

export async function generarTokenSubdistribuidor(req: AuthedReq): Promise<unknown> {
  if (!req.auth) {
    throw new APIError('unauthenticated', 'Debes iniciar sesión');
  }

  const uid = req.auth.uid;
  const userEmail = (req.auth.token?.email as string) || '';
  const data = dataOf(req);
  const {
    cuentaId, perfilNombre, expiraEn, clienteNombre,
    cantidad, totalRecibido, precioPorPerfil, totalCosto, utilidad,
    diasAcceso, perfilesSeleccionados, proveedor, costoServicio,
  } = data;

  if (!cuentaId || !expiraEn) {
    throw new APIError('invalid-argument', 'cuentaId y expiraEn son requeridos');
  }

  // Validar que expiraEn sea una fecha futura
  const expiraDate = new Date(expiraEn as string);
  if (isNaN(expiraDate.getTime()) || expiraDate <= new Date()) {
    throw new APIError('invalid-argument', 'expiraEn debe ser una fecha futura');
  }

  // Verificar suscripción Enterprise
  const userDoc = await db.collection('usuarios').doc(uid).get();
  if (!userDoc.exists) {
    throw new APIError('permission-denied', 'Usuario no encontrado');
  }

  const suscripcionSnapshot = await db.collection('suscripciones').get();
  const suscripcionActiva = suscripcionSnapshot.docs
    .map(d => d.data())
    .find((s: any) => s.usuarioId === uid && s.estado === 'activa');

  if (!suscripcionActiva) {
    throw new APIError(
      'permission-denied',
      'Se requiere plan Enterprise para generar links para sub-distribuidores'
    );
  }

  const plan = ((suscripcionActiva as any).planNombre as string)?.toLowerCase() || '';
  if (!plan.includes('enterprise')) {
    throw new APIError(
      'permission-denied',
      'Se requiere plan Enterprise para generar links para sub-distribuidores'
    );
  }

  const token = uuidv4();

  // Transacción atómica: o se escriben todos los documentos o ninguno
  await db.runTransaction(async (transaction) => {
    const cuentaRef = db.collection('cuentas').doc(cuentaId as string);
    const cuentaSnap = await transaction.get(cuentaRef);

    if (!cuentaSnap.exists) {
      throw new APIError('not-found', 'Cuenta no encontrada');
    }

    const cuentaData = cuentaSnap.data()!;
    if (cuentaData.propietarioId !== uid) {
      throw new APIError('permission-denied', 'No tienes permisos sobre esta cuenta');
    }

    // Crear token
    const tokenRef = db.collection('tokens').doc(token);
    transaction.set(tokenRef, {
      token,
      cuentaId,
      perfilNombre: perfilNombre || null,
      clienteId: '',
      clienteNombre: clienteNombre || '',
      vendedorId: uid,
      expiraEn: expiraDate.toISOString(),
      activo: true,
      useCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Registrar venta y movimiento (si hay precio)
    if ((totalRecibido as number) > 0) {
      const ventaRef = db.collection('ventas').doc();
      transaction.set(ventaRef, {
        nombre: clienteNombre || 'Sub-distribuidor',
        telefono: '0000000000',
        correo: '',
        plataforma: proveedor || '',
        pantallas: cantidad || 1,
        precioVenta: precioPorPerfil || 0,
        costoServicio: totalCosto || 0,
        utilidad: utilidad || 0,
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaVenta: new Date().toISOString().split('T')[0],
        diasServicio: diasAcceso || 30,
        perfil: '',
        pinPerfil: '',
        pagado: true,
        saldoPendiente: 0,
        fechaRegistro: admin.firestore.FieldValue.serverTimestamp(),
        fechaRegistroSistema: null,
        fechaVencimiento: expiraDate.toISOString().split('T')[0],
        propietarioId: uid,
        usuarioEmail: userEmail,
        cuentaId,
        tokenGenerado: token,
        costoPorPerfil: costoServicio || 0,
        esSubdistribuidor: true,
      });

      const movRef = db.collection('movimientos').doc();
      transaction.set(movRef, {
        tipo: 'Ingreso',
        monto: totalRecibido,
        descripcion: `Venta ${cantidad || 1} perfil(es) ${proveedor || ''} (Sub-distribuidor)`,
        fecha: admin.firestore.FieldValue.serverTimestamp(),
        propietarioId: uid,
        usuarioEmail: userEmail,
      });
    }

    // Actualizar perfiles seleccionados
    if (perfilesSeleccionados && (perfilesSeleccionados as unknown[]).length > 0) {
      const perfiles = [...(Array.isArray(cuentaData.perfiles) ? cuentaData.perfiles : [])];
      const hoy = new Date().toISOString().split('T')[0];

      (perfilesSeleccionados as unknown as number[]).forEach((idx: number) => {
        if (idx >= 0 && idx < perfiles.length) {
          perfiles[idx] = {
            ...perfiles[idx],
            estado: 'asignado' as const,
            clienteNombre: clienteNombre || 'Sub-distribuidor',
            fechaAsignacion: hoy,
          };
        }
      });

      const quedanDisponibles = perfiles.some((p: any) => p.estado === 'disponible');
      transaction.update(cuentaRef, {
        perfiles,
        ...(quedanDisponibles ? {} : { estado: 'asignada' as const }),
      });
    }
  });

  return {
    token,
    url: `/r/${token}`,
    expiraEn: expiraDate.toISOString(),
  };
}

export async function obtenerCredencialesCuenta(req: AuthedReq): Promise<unknown> {
  if (!req.auth) {
    throw new APIError('unauthenticated', 'Debes iniciar sesión');
  }

  const uid = req.auth.uid;
  const { cuentaId } = dataOf(req);

  if (!cuentaId) {
    throw new APIError('invalid-argument', 'cuentaId es requerido');
  }

  // Verificar que la cuenta pertenece al usuario
  const cuentaRef = db.collection('cuentas').doc(cuentaId as string);
  const cuentaSnap = await cuentaRef.get();
  if (!cuentaSnap.exists) {
    throw new APIError('not-found', 'Cuenta no encontrada');
  }

  const cuentaData = cuentaSnap.data()!;
  if (cuentaData.propietarioId !== uid) {
    throw new APIError('permission-denied', 'No tienes permisos sobre esta cuenta');
  }

  // Obtener credenciales de cuentas_secretos
  const secretosSnap = await db.collection('cuentas_secretos').doc(cuentaId as string).get();
  const secretos = secretosSnap.exists ? secretosSnap.data() : null;

  return {
    proveedor: cuentaData.proveedor || '',
    correoCuenta: cuentaData.correoCuenta || '',
    perfiles: cuentaData.perfiles || [],
    correo: secretos?.correo || '',
    contrasena: secretos?.contrasena || '',
  };
}