/**
 * Lógica de desasignación de perfiles
 * 
 * Compartida entre:
 * - Cloud Function `desasignarPerfil` (llamada manual desde frontend)
 * - Cron `generarNotificacionesVencimientos` (auto-cleanup a los 3 días de vencido)
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

interface DesasignarResult {
  success: boolean;
  clienteNombre?: string;
  perfilNombre?: string;
  cuentaId?: string;
  error?: string;
}

/**
 * Desasigna un perfil de cuenta de un cliente específico.
 * 
 * Operaciones atómicas:
 * 1. Marca el perfil como 'disponible' en la cuenta
 * 2. Limpia clienteNombre/fechaAsignacion del perfil
 * 3. Limpia cuentaId/perfilAsignado del cliente
 * 4. Si cuenta estaba 'asignada' y ahora tiene disponibles → pasa a 'disponible'
 */
export async function desasignarPerfil(
  clienteId: string,
  cuentaId: string,
  perfilNombre: string,
): Promise<DesasignarResult> {
  try {
    // ── 1. Leer cuenta y validar ──
    const cuentaRef = db.collection('cuentas').doc(cuentaId);
    const cuentaSnap = await cuentaRef.get();

    if (!cuentaSnap.exists) {
      return { success: false, error: 'La cuenta no existe' };
    }

    const cuenta = cuentaSnap.data()!;
    const perfiles = cuenta.perfiles as Array<{
      nombre: string;
      pin?: string;
      estado: string;
      clienteNombre?: string;
      fechaAsignacion?: string;
    }>;

    if (!Array.isArray(perfiles)) {
      return { success: false, error: 'La cuenta no tiene perfiles' };
    }

    // Buscar el perfil por nombre
    const idx = perfiles.findIndex((p: any) => p.nombre === perfilNombre);
    if (idx === -1) {
      return { success: false, error: `Perfil "${perfilNombre}" no encontrado en la cuenta` };
    }

    const perfil = perfiles[idx];

    // Si ya está disponible, no hacer nada
    if (perfil.estado === 'disponible') {
      return { success: true, clienteNombre: perfil.clienteNombre, perfilNombre, cuentaId, error: 'El perfil ya estaba disponible' };
    }

    // ── 2. Actualizar el perfil ──
    // NO usar FieldValue.delete() dentro del array — Firestore no lo permite.
    // En vez de eso, omitir las propiedades directamente (equivalente a borrarlas).
    const { clienteNombre: _cn, fechaAsignacion: _fa, ...perfilRestante } = perfil;
    perfiles[idx] = {
      ...perfilRestante,
      estado: 'disponible',
    };

    // ── 3. Determinar nuevo estado de la cuenta ──
    const quedanDisponibles = perfiles.some((p: any) => p.estado === 'disponible');
    const nuevoEstadoCuenta = quedanDisponibles ? 'disponible' : 'asignada';

    // ── 4. Batch write ──
    const batch = db.batch();

    batch.update(cuentaRef, {
      perfiles,
      estado: nuevoEstadoCuenta,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Limpiar cuentaId/perfilAsignado del cliente
    const clienteRef = db.collection('clientes').doc(clienteId);
    batch.update(clienteRef, {
      cuentaId: admin.firestore.FieldValue.delete(),
      perfilAsignado: admin.firestore.FieldValue.delete(),
    });

    await batch.commit();

    return {
      success: true,
      clienteNombre: perfil.clienteNombre || undefined,
      perfilNombre,
      cuentaId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`Error desasignando perfil ${perfilNombre} de cuenta ${cuentaId}:`, message);
    return { success: false, error: message };
  }
}

/**
 * Busca clientes cuya fechaVencimiento pasó hace más de `diasGracia` días
 * y libera sus perfiles automáticamente.
 * Con diasGracia = 0, fechaLimiteStr es hoy (YYYY-MM-DD), capturando clientes
 * con fechaVencimiento < hoyStr (vencidos ayer o antes / 1 día de gracia cumplido).
 * 
 * Retorna la cantidad de perfiles liberados.
 */
export async function limpiarPerfilesVencidos(diasGracia: number = 0): Promise<number> {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fechaLimite = new Date(hoy);
  fechaLimite.setDate(hoy.getDate() - diasGracia);
  const fechaLimiteStr = fechaLimite.toISOString().split('T')[0];

  // Buscar clientes con fechaVencimiento anterior a la fecha límite
  const vencidosSnapshot = await db.collection('clientes')
    .where('fechaVencimiento', '<', fechaLimiteStr)
    .get();

  let liberados = 0;
  let saltados = 0;
  let batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 500;

  for (const doc of vencidosSnapshot.docs) {
    const cliente = doc.data();
    const cuentaId = cliente.cuentaId as string | undefined;
    const perfilAsignado = cliente.perfilAsignado as string | undefined;

    // Saltar clientes sin cuenta asignada o sin perfil
    if (!cuentaId || !perfilAsignado) {
      saltados++;
      continue;
    }

    // Leer la cuenta para verificar que el perfil sigue asignado
    const cuentaSnap = await db.collection('cuentas').doc(cuentaId).get();
    if (!cuentaSnap.exists) {
      // La cuenta fue eliminada — limpiar solo el cliente
      batch.update(doc.ref, {
        cuentaId: admin.firestore.FieldValue.delete(),
        perfilAsignado: admin.firestore.FieldValue.delete(),
      });
      batchCount++;
      liberados++;
      if (batchCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
      continue;
    }

    const cuenta = cuentaSnap.data()!;
    const perfiles = (cuenta.perfiles || []) as Array<any>;
    const idx = perfiles.findIndex((p: any) => p.nombre === perfilAsignado);

    if (idx === -1) {
      // El perfil ya no existe — limpiar solo el cliente
      batch.update(doc.ref, {
        cuentaId: admin.firestore.FieldValue.delete(),
        perfilAsignado: admin.firestore.FieldValue.delete(),
      });
      batchCount++;
      liberados++;
      if (batchCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
      continue;
    }

    const perfil = perfiles[idx];

    // Si ya fue liberado manualmente, saltar
    if (perfil.estado === 'disponible') {
      // Limpiar de todas formas el cliente por si quedó huérfano
      batch.update(doc.ref, {
        cuentaId: admin.firestore.FieldValue.delete(),
        perfilAsignado: admin.firestore.FieldValue.delete(),
      });
      batchCount++;
      liberados++;
      if (batchCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
      continue;
    }

    // Marcar perfil como disponible (misma técnica: omitir, no FieldValue.delete())
    const { clienteNombre: _cn, fechaAsignacion: _fa, ...perfilRestante } = perfil;
    perfiles[idx] = {
      ...perfilRestante,
      estado: 'disponible',
    };

    const quedanDisponibles = perfiles.some((p: any) => p.estado === 'disponible');
    const nuevoEstadoCuenta = quedanDisponibles ? 'disponible' : 'asignada';

    batch.update(cuentaSnap.ref, {
      perfiles,
      estado: nuevoEstadoCuenta,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Limpiar cliente
    batch.update(doc.ref, {
      cuentaId: admin.firestore.FieldValue.delete(),
      perfilAsignado: admin.firestore.FieldValue.delete(),
    });

    batchCount += 2; // cuenta + cliente = 2 writes
    liberados++;

    if (batchCount >= MAX_BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit restante
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`limpiarPerfilesVencidos: ${liberados} liberados, ${saltados} sin cuenta/perfil`);
  return liberados;
}
