import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { buscarCodigoVerificacion, IMAPConfig } from './imap';

const db = admin.firestore();

const TOKEN_MAX_USES = 10;
const DEFAULT_TOKEN_EXPIRY_DAYS = 30;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 5; // max 5 requests per token per minute

export const generarToken = functions
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Debes iniciar sesión'
      );
    }

    const uid = context.auth.uid;
    const userEmail = context.auth.token.email || '';

    // DEBUG: Log del UID y email
    console.error(`[generarToken] uid="${uid}" email="${userEmail}"`);

    // Validar que el usuario existe en la colección usuarios
    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (!userDoc.exists) {
      console.error(`[generarToken] Usuario ${uid} no encontrado en colección usuarios`);
      throw new functions.https.HttpsError(
        'permission-denied',
        'Usuario no encontrado'
      );
    }

    const userData = userDoc.data()!;
    console.error(`[generarToken] Usuario: rol=${userData.rol}, estado=${userData.estado}`);

    // Verificar suscripción
    const suscripcionSnapshot = await db.collection('suscripciones').get();
    console.error(`[generarToken] Total suscripciones en DB: ${suscripcionSnapshot.size}`);

    if (suscripcionSnapshot.size > 0) {
      suscripcionSnapshot.forEach(d => {
        const data = d.data();
        console.error(`[generarToken] Sub: usuarioId="${data.usuarioId}" estado="${data.estado}" plan="${data.planNombre}"`);
      });
    }

    const suscripcionActiva = suscripcionSnapshot.docs
      .map(d => d.data() as any)
      .find(s => s.usuarioId === uid && s.estado === 'activa');

    if (!suscripcionActiva) {
      console.error(`[generarToken] NO hay suscripcion activa para uid="${uid}"`);
      console.error(`[generarToken] ¿Admin? rol=${userData.rol}`);
      throw new functions.https.HttpsError(
        'permission-denied',
        'Se requiere plan Enterprise para generar tokens'
      );
    }

    const plan = (suscripcionActiva.planNombre as string)?.toLowerCase() || '';
    console.error(`[generarToken] Plan activo: "${plan}"`);

    if (!plan.includes('enterprise')) {
      console.error(`[generarToken] Plan "${plan}" no incluye "enterprise"`);
      throw new functions.https.HttpsError(
        'permission-denied',
        'Se requiere plan Enterprise para generar tokens'
      );
    }

    const { cuentaId, perfilNombre, clienteId, clienteNombre, expiraEn } = data;

    if (!cuentaId || !perfilNombre || !clienteId || !clienteNombre) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Faltan campos requeridos: cuentaId, perfilNombre, clienteId, clienteNombre'
      );
    }

    const cuentaDoc = await db.collection('cuentas').doc(cuentaId).get();
    if (!cuentaDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'La cuenta especificada no existe'
      );
    }

    const cuenta = cuentaDoc.data()!;
    if (cuenta.propietarioId !== uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'No tienes permisos sobre esta cuenta'
      );
    }

    const token = uuidv4();
    const ahora = admin.firestore.FieldValue.serverTimestamp();
    const expiraEnDate = expiraEn
      ? expiraEn
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
  });

export const validarToken = functions
  .runWith({ timeoutSeconds: 15, memory: '128MB' })
  .https.onCall(async (data) => {
    const { token } = data;
    if (!token || typeof token !== 'string') {
      throw new functions.https.HttpsError(
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
  });

export const consultarCodigo = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data) => {
    const { token, caso } = data;

    if (!token || !caso) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Token y caso son requeridos'
      );
    }

    const tokenDoc = await db.collection('tokens').doc(token).get();
    if (!tokenDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Token no encontrado'
      );
    }

    const tokenData = tokenDoc.data()!;

    if (!tokenData.activo) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Token revocado — contacta a tu vendedor'
      );
    }

    const expiraEn = new Date(tokenData.expiraEn as string);
    if (expiraEn < new Date()) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Token expirado'
      );
    }

    const now = Date.now();
    if (tokenData.rateLimit && tokenData.rateLimit.count >= MAX_REQUESTS
        && (now - (tokenData.rateLimit.windowStart as number)) < RATE_LIMIT_WINDOW) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Demasiadas consultas. Intenta de nuevo en unos minutos.'
      );
    }

    const currentUses = (tokenData.useCount as number) || 0;
    if (currentUses >= TOKEN_MAX_USES) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Límite de consultas alcanzado para este token'
      );
    }

    const cuentaId = tokenData.cuentaId as string;
    const proveedor = tokenData.proveedor as string;

    const cuentaDoc = await db.collection('cuentas').doc(cuentaId).get();
    if (!cuentaDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Cuenta no encontrada'
      );
    }

    const cuentaData = cuentaDoc.data()!;
    const servicio = cuentaData.proveedor as string;

    const secretosDoc = await db.collection('cuentas_secretos').doc(cuentaId).get();
    if (!secretosDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Credenciales de cuenta no encontradas'
      );
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

      if (!result) {
        return {
          encontrado: false,
          mensaje: 'Código no encontrado — verifica que el código haya sido enviado al correo',
        };
      }

      // Incrementar contador solo en consultas exitosas
      await db.collection('tokens').doc(token).update({
        useCount: admin.firestore.FieldValue.increment(1),
        'rateLimit.count': admin.firestore.FieldValue.increment(1),
        'rateLimit.windowStart': tokenData.rateLimit?.windowStart || now,
      });

      return {
        encontrado: true,
        codigo: result.codigo,
        email: imapConfig.correo,
        fecha: result.fecha,
        tipo: caso,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error en consultarCodigo (IMAP):', message);

      if (message.includes('Connection timeout') || message.includes('connect')) {
        throw new functions.https.HttpsError(
          'unavailable',
          'No se pudo conectar al correo de la cuenta'
        );
      }

      if (message.includes('authentication') || message.includes('auth')) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Error de autenticación IMAP — verifica las credenciales de la cuenta'
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        'Error al consultar el código'
      );
    }
  });

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

export const guardarCredenciales = functions
  .runWith({ timeoutSeconds: 15, memory: '128MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Debes iniciar sesión'
      );
    }

    const uid = context.auth.uid;
    const { cuentaId, correo, contrasena, imapHost, imapPort, proveedorIMAP } = data;

    if (!cuentaId || !correo || !contrasena) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Faltan campos requeridos: cuentaId, correo, contrasena'
      );
    }

    // Verificar que la cuenta existe y pertenece al usuario
    const cuentaDoc = await db.collection('cuentas').doc(cuentaId).get();
    if (!cuentaDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'La cuenta especificada no existe'
      );
    }

    const cuenta = cuentaDoc.data()!;
    if (cuenta.propietarioId !== uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'No tienes permisos sobre esta cuenta'
      );
    }

    // Guardar credenciales en cuentas_secretos (solo accesible por Admin SDK)
    await db.collection('cuentas_secretos').doc(cuentaId).set({
      cuentaId,
      correo,
      contrasena,
      imapHost: imapHost || 'imap.gmail.com',
      imapPort: imapPort || 993,
      proveedorIMAP: proveedorIMAP || 'gmail',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true, cuentaId };
  });

export const toggleToken = functions
  .runWith({ timeoutSeconds: 15, memory: '128MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }

    const uid = context.auth.uid;
    const { tokenId, activo } = data;

    if (!tokenId) {
      throw new functions.https.HttpsError('invalid-argument', 'tokenId es requerido');
    }

    if (typeof activo !== 'boolean') {
      throw new functions.https.HttpsError('invalid-argument', 'activo debe ser booleano');
    }

    const tokenDoc = await db.collection('tokens').doc(tokenId).get();
    if (!tokenDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Token no encontrado');
    }

    const tokenData = tokenDoc.data()!;
    if (tokenData.vendedorId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'No tienes permisos sobre este token');
    }

    await db.collection('tokens').doc(tokenId).update({
      activo,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, activo };
  });

// Rate limiting para consultarCodigoDirecto (por usuario y por cuenta)
const consultaDirectaLimits = {
  user: new Map<string, number[]>(),
  cuenta: new Map<string, number[]>(),
};

function checkRateLimit(map: Map<string, number[]>, key: string, maxRequests: number, windowMs: number): void {
  const ahora = Date.now();
  const timestamps = map.get(key) || [];
  const ventana = timestamps.filter(t => ahora - t < windowMs);
  if (ventana.length >= maxRequests) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Demasiadas consultas. Esperá un momento antes de intentar de nuevo.'
    );
  }
  ventana.push(ahora);
  map.set(key, ventana);
}

export const consultarCodigoDirecto = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }

    const uid = context.auth.uid;
    const { cuentaId, caso } = data;

    if (!cuentaId || !caso) {
      throw new functions.https.HttpsError('invalid-argument', 'cuentaId y caso son requeridos');
    }

    // Rate limiting: max 10 consultas por usuario por minuto
    checkRateLimit(consultaDirectaLimits.user, uid, 10, 60_000);

    // Verificar que la cuenta existe y pertenece al usuario
    const cuentaDoc = await db.collection('cuentas').doc(cuentaId).get();
    if (!cuentaDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Cuenta no encontrada');
    }

    const cuentaData = cuentaDoc.data()!;
    if (cuentaData.propietarioId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'No tienes permisos sobre esta cuenta');
    }

    // Rate limiting: max 5 consultas por cuenta por minuto (protección IMAP)
    checkRateLimit(consultaDirectaLimits.cuenta, cuentaId, 5, 60_000);

    const servicio = cuentaData.proveedor as string;

    // Buscar credenciales IMAP
    const secretosDoc = await db.collection('cuentas_secretos').doc(cuentaId).get();
    if (!secretosDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Credenciales IMAP no configuradas');
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

      if (!result) {
        return {
          encontrado: false,
          mensaje: 'Código no encontrado — verifica que el código haya sido enviado al correo',
        };
      }

      return {
        encontrado: true,
        codigo: result.codigo,
        email: imapConfig.correo,
        fecha: result.fecha,
        tipo: caso,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error en consultarCodigoDirecto (IMAP):', message);

      if (message.includes('Connection timeout') || message.includes('connect')) {
        throw new functions.https.HttpsError('unavailable', 'No se pudo conectar al correo de la cuenta');
      }
      if (message.includes('authentication') || message.includes('auth')) {
        throw new functions.https.HttpsError('permission-denied', 'Error de autenticación IMAP');
      }

      throw new functions.https.HttpsError('internal', 'Error al consultar el código');
    }
  });

export const generarTokenSubdistribuidor = functions
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }

    const uid = context.auth.uid;
    const { cuentaId, perfilNombre, expiraEn, clienteNombre } = data;

    if (!cuentaId || !expiraEn) {
      throw new functions.https.HttpsError('invalid-argument', 'cuentaId y expiraEn son requeridos');
    }

    // Verificar que la cuenta existe y pertenece al usuario
    const cuentaDoc = await db.collection('cuentas').doc(cuentaId).get();
    if (!cuentaDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Cuenta no encontrada');
    }

    const cuentaData = cuentaDoc.data()!;
    if (cuentaData.propietarioId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'No tienes permisos sobre esta cuenta');
    }

    // Validar que expiraEn sea una fecha futura
    const expiraDate = new Date(expiraEn);
    if (isNaN(expiraDate.getTime()) || expiraDate <= new Date()) {
      throw new functions.https.HttpsError('invalid-argument', 'expiraEn debe ser una fecha futura');
    }

    const token = uuidv4();
    await db.collection('tokens').doc(token).set({
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

    return {
      token,
      url: `/r/${token}`,
      expiraEn: expiraDate.toISOString(),
    };
  });
