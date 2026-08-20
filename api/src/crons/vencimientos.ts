/**
 * Cron de vencimientos (AD-2): módulo compartido entre GH Actions (scripts/cron-vencimientos.ts)
 * y la ruta HTTP si hiciera falta. Port EXACTO del cuerpo de generarNotificacionesVencimientos
 * (functions/index.ts:90-358), mismo orden de queries y mismos ids de notificación.
 *
 * Se ejecuta desde GitHub Actions con FIREBASE_SERVICE_ACCOUNT + TELEGRAM_TOKEN.
 * NO puede usar la ruta HTTP: supera el límite de runtime de Vercel Hobby.
 */

import * as admin from 'firebase-admin';
import { APP_URL } from '../config.js';
import { limpiarPerfilesVencidos } from '../desasignar.js';
import { getDb } from '../firebase.js';
import * as telegram from '../telegram.js';

const db = getDb();

export interface ResultadoVencimientos {
  notificacionesCreadas: number;
  telegramEnviados: number;
  morasNotificadas: number;
  autoExpiradas: number;
  perfilesLiberados: number;
}

export async function generarNotificacionesVencimientos(): Promise<ResultadoVencimientos> {
  console.log('🔔 Iniciando generación de notificaciones de vencimientos...');

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Rango de vencimiento: clientes que vencen en 1 a 3 días
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  const dentroDe3Dias = new Date(hoy);
  dentroDe3Dias.setDate(hoy.getDate() + 3);

  // fechaVencimiento se almacena como string YYYY-MM-DD (orden lexicográfico = cronológico)
  const mananaStr = manana.toISOString().split('T')[0];
  const dentroDe3DiasStr = dentroDe3Dias.toISOString().split('T')[0];

  // ── Query 1: Clientes próximos a vencer ──
  const vencimientoSnapshot = await db
    .collection('clientes')
    .where('fechaVencimiento', '>=', mananaStr)
    .where('fechaVencimiento', '<=', dentroDe3DiasStr)
    .get();

  // ── Query 2: Clientes con saldo pendiente (mora) ──
  const moraSnapshot = await db.collection('clientes').where('saldoPendiente', '>', 0).get();

  let notificacionesCreadas = 0;
  let telegramEnviados = 0;
  let morasNotificadas = 0;
  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 500;

  // Procesar vencimientos
  for (const clienteDoc of vencimientoSnapshot.docs) {
    const cliente = clienteDoc.data() as admin.firestore.DocumentData;

    if (cliente.fechaVencimiento) {
      const fechaVencimiento = new Date(cliente.fechaVencimiento);
      fechaVencimiento.setHours(0, 0, 0, 0);

      const diffTime = fechaVencimiento.getTime() - hoy.getTime();
      const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diasRestantes >= 1 && diasRestantes <= 3) {
        const hoyStr = hoy.toISOString().split('T')[0];
        const notificacionId = `${cliente.propietarioId}_${clienteDoc.id}_${hoyStr}`;

        const notifRef = db.collection('notificaciones').doc(notificacionId);
        const notifDoc = await notifRef.get();

        if (!notifDoc.exists) {
          const notificacion = {
            clienteId: clienteDoc.id,
            nombreCliente: cliente.nombre || '',
            plataforma: cliente.plataforma || '',
            diasRestantes,
            fechaVencimiento: cliente.fechaVencimiento,
            propietarioId: cliente.propietarioId,
            usuarioEmail: cliente.usuarioEmail || '',
            fechaGenerada: admin.firestore.FieldValue.serverTimestamp(),
            leida: false,
          };

          batch.set(notifRef, notificacion);
          batchCount++;
          notificacionesCreadas++;

          try {
            const enviado = await telegram.enviarNotificacionVencimiento(
              { ...notificacion, telefono: cliente.telefono || '' },
              { appUrl: APP_URL() }
            );
            if (enviado) telegramEnviados++;
          } catch (err) {
            console.error(`Error enviando Telegram para ${cliente.nombre}:`, err);
          }

          if (batchCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }
    }
  }

  // ── Procesar mora (saldo pendiente) ──
  for (const clienteDoc of moraSnapshot.docs) {
    const cliente = clienteDoc.data() as admin.firestore.DocumentData;

    if (cliente.saldoPendiente > 0) {
      const hoyStr = hoy.toISOString().split('T')[0];
      const notifId = `mora_${clienteDoc.id}_${hoyStr}`;
      const notifRef = db.collection('notificaciones').doc(notifId);
      const notifDoc = await notifRef.get();

      if (!notifDoc.exists) {
        batch.set(notifRef, {
          clienteId: clienteDoc.id,
          nombreCliente: cliente.nombre || '',
          tipo: 'mora',
          saldoPendiente: cliente.saldoPendiente,
          propietarioId: cliente.propietarioId,
          fechaGenerada: admin.firestore.FieldValue.serverTimestamp(),
        });
        batchCount++;

        try {
          const enviado = await telegram.enviarNotificacionMora(cliente, { appUrl: APP_URL() });
          if (enviado) morasNotificadas++;
        } catch (err) {
          console.error(`Error enviando mora Telegram para ${cliente.nombre}:`, err);
        }

        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }
  }

  // ── Procesar suscripciones próximas a vencer ──
  const suscripcionesSnapshot = await db.collection('suscripciones').where('estado', '==', 'activa').get();

  let autoExpiradas = 0;

  for (const susDoc of suscripcionesSnapshot.docs) {
    const sus = susDoc.data() as admin.firestore.DocumentData;
    const fechaFin = (sus.fechaFin as unknown as { toDate(): Date }).toDate();
    fechaFin.setHours(0, 0, 0, 0);

    const diffTime = fechaFin.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // ⏰ Si ya venció → marcar como expirada automáticamente
    if (diasRestantes < 0) {
      await susDoc.ref.update({ estado: 'expirada' });
      autoExpiradas++;
      continue; // saltamos notificación, ya está expirada
    }

    if (diasRestantes >= 0 && diasRestantes <= 3) {
      const hoyStr = hoy.toISOString().split('T')[0];
      const notifId = `sub_${susDoc.id}_${hoyStr}`;

      const notifRef = db.collection('notificaciones').doc(notifId);
      const notifDoc = await notifRef.get();

      if (!notifDoc.exists) {
        batch.set(notifRef, {
          suscripcionId: susDoc.id,
          usuarioNombre: sus.usuarioNombre || '',
          planNombre: sus.planNombre || '',
          diasRestantes,
          fechaFin: sus.fechaFin,
          fechaGenerada: admin.firestore.FieldValue.serverTimestamp(),
          leida: false,
        });
        batchCount++;
        notificacionesCreadas++;

        try {
          const enviado = await telegram.enviarNotificacionSuscripcion(
            {
usuarioNombre: sus.usuarioNombre || '',
              planNombre: sus.planNombre || '',
              diasRestantes,
              fechaFin: sus.fechaFin as unknown as { toDate(): Date },
              estado: sus.estado || 'activa',
            },
            { appUrl: APP_URL() }
          );
          if (enviado) telegramEnviados++;
        } catch (err) {
          console.error(`Error enviando Telegram suscripción para ${sus.usuarioNombre}:`, err);
        }

        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }
  }

  // ── Procesar cuentas próximas a vencer ──
  const cuentasSnapshot = await db.collection('cuentas').get();

  for (const cuentaDoc of cuentasSnapshot.docs) {
    const cuenta = cuentaDoc.data() as admin.firestore.DocumentData;
    const fechaVencimiento = cuenta.fechaVencimiento as string | undefined;

    if (!fechaVencimiento || cuenta.estado === 'expirada') continue;

    const venc = new Date(fechaVencimiento + 'T00:00:00');
    const diffTime = venc.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diasRestantes >= 0 && diasRestantes <= 3) {
      const hoyStr = hoy.toISOString().split('T')[0];
      const notifId = `cuenta_${cuentaDoc.id}_${hoyStr}`;

      const notifRef = db.collection('notificaciones').doc(notifId);
      const notifDoc = await notifRef.get();

      if (!notifDoc.exists) {
        batch.set(notifRef, {
          cuentaId: cuentaDoc.id,
          proveedor: cuenta.proveedor || '',
          correoCuenta: cuenta.correoCuenta || '',
          diasRestantes,
          fechaVencimiento,
          propietarioId: cuenta.propietarioId,
          fechaGenerada: admin.firestore.FieldValue.serverTimestamp(),
          leida: false,
        });
        batchCount++;
        notificacionesCreadas++;

        try {
          const enviado = await telegram.enviarNotificacionCuentaVencimiento(
            {
              proveedor: cuenta.proveedor || '',
              correoCuenta: cuenta.correoCuenta || '',
              diasRestantes,
              fechaVencimiento,
              propietarioId: cuenta.propietarioId,
            },
            { appUrl: APP_URL() }
          );
          if (enviado) telegramEnviados++;
        } catch (err) {
          console.error(`Error enviando Telegram cuenta para ${cuenta.proveedor}:`, err);
        }

        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  // ── Auto-cleanup: liberar perfiles de clientes vencidos hace +3 días ──
  const perfilesLiberados = await limpiarPerfilesVencidos(3);
  if (perfilesLiberados > 0) {
    console.log(`${perfilesLiberados} perfil(es) liberado(s) automáticamente`);
  }

  const resumen = {
    notificacionesCreadas,
    telegramEnviados,
    morasNotificadas,
    autoExpiradas,
    perfilesLiberados,
  };
  console.log(
    `${notificacionesCreadas} notifs Firestore, ${telegramEnviados} Telegram vencimientos, ${morasNotificadas} Telegram moras, ${autoExpiradas} suscripciones auto-expiradas, ${perfilesLiberados} perfiles liberados`
  );
  return resumen;
}