/**
 * Cloud Functions para StreamControl Pro
 * 
 * Función programada que genera notificaciones automáticas
 * cuando los clientes están próximos a vencer (1, 2 o 3 días)
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as telegram from './telegram';
import { APP_URL } from './telegram';
import { sendWelcomeEmail, sendPasswordChangedEmail, sendEmailChangedEmail, sendResetPasswordEmail } from './email';
export { generarToken, validarToken, consultarCodigo, guardarCredenciales, toggleToken } from './src/codigos';

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Webhook de Telegram Bot
 * Recibe actualizaciones del bot de Telegram y las procesa
 * 
 * Configuración requerida:
 *   firebase functions:config:set telegram.token="TOKEN" telegram.webhook_secret="SECRET"
 * 
 * Para activar el webhook (pegar URL después del primer deploy):
 *   curl -F "url=DEPLOYED_URL/telegramWebhook" -F "secret_token=SECRET" https://api.telegram.org/botTOKEN/setWebhook
 */
export const telegramWebhook = functions
  .runWith({ secrets: ['TELEGRAM_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'] })
  .https.onRequest(async (req: functions.https.Request, res: functions.Response) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!telegram.verifyWebhook(req)) {
    console.error('❌ Webhook verification failed — invalid secret token');
    res.status(403).send('Forbidden');
    return;
  }

  try {
    const result = await telegram.handleUpdate(req.body as Record<string, unknown>);
    console.log('✅ Telegram update processed:', result);
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing Telegram update:', error);
    res.status(200).send('OK');
  }
});

/**
 * Cuando se crea un nuevo documento en usuarios/{uid} (registro),
 * envía un email de bienvenida vía SMTP (nodemailer + Gmail).
 * 
 * Configuración requerida:
 *   firebase functions:secrets:set SMTP_USER
 *   firebase functions:secrets:set SMTP_PASS
 */
export const onNuevoUsuario = functions
  .runWith({ secrets: ['SMTP_USER', 'SMTP_PASS'] })
  .firestore
  .document('usuarios/{uid}')
  .onCreate(async (snap, context) => {
    const { correo, nombre } = snap.data() as { correo?: string; nombre?: string };

    if (!correo) {
      console.log('⏭️ No correo field on new user doc, skipping welcome email');
      return;
    }

    try {
      await sendWelcomeEmail(correo, nombre || 'Usuario');
      console.log('✅ Welcome email process completed for', correo);
    } catch (error) {
      console.error('❌ Welcome email failed for', correo, error);
    }
  });

/**
 * Extensión del cron: envía notificaciones por Telegram
 */
export const generarNotificacionesVencimientos = functions
  .runWith({ secrets: ['TELEGRAM_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'] })
  .pubsub
  .schedule('every 24 hours')
  .timeZone('America/Bogota')
  .onRun(async (context: functions.EventContext) => {
    console.log('🔔 Iniciando generación de notificaciones de vencimientos...');

    try {
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
      const vencimientoSnapshot = await db.collection('clientes')
        .where('fechaVencimiento', '>=', mananaStr)
        .where('fechaVencimiento', '<=', dentroDe3DiasStr)
        .get();

      // ── Query 2: Clientes con saldo pendiente (mora) ──
      const moraSnapshot = await db.collection('clientes')
        .where('saldoPendiente', '>', 0)
        .get();

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
                const enviado = await telegram.enviarNotificacionVencimiento({
                  ...notificacion,
                  telefono: cliente.telefono || '',
                }, {
                  appUrl: APP_URL.value(),
                });
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
              const enviado = await telegram.enviarNotificacionMora(cliente, {
                appUrl: APP_URL.value(),
              });
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
      const suscripcionesSnapshot = await db.collection('suscripciones')
        .where('estado', '==', 'activa')
        .get();

      for (const susDoc of suscripcionesSnapshot.docs) {
        const sus = susDoc.data() as admin.firestore.DocumentData;
        const fechaFin = (sus.fechaFin as admin.firestore.Timestamp).toDate();
        fechaFin.setHours(0, 0, 0, 0);

        const diffTime = fechaFin.getTime() - hoy.getTime();
        const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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
              const enviado = await telegram.enviarNotificacionSuscripcion({
                usuarioNombre: sus.usuarioNombre || '',
                planNombre: sus.planNombre || '',
                fechaFin: sus.fechaFin as admin.firestore.Timestamp,
                diasRestantes,
                estado: sus.estado || 'activa',
              }, {
                appUrl: APP_URL.value(),
              });
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
              const enviado = await telegram.enviarNotificacionCuentaVencimiento({
                proveedor: cuenta.proveedor || '',
                correoCuenta: cuenta.correoCuenta || '',
                diasRestantes,
                fechaVencimiento,
                propietarioId: cuenta.propietarioId,
              }, {
                appUrl: APP_URL.value(),
              });
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

      console.log(`✅ ${notificacionesCreadas} notifs Firestore, ${telegramEnviados} Telegram vencimientos, ${morasNotificadas} Telegram moras`);
      return null;
    } catch (error) {
      console.error('❌ Error generando notificaciones:', error);
      throw error;
    }
  });

/**
 * Cuando se crea una notificación de cambio en notificacionesEmail,
 * envía un email de confirmación al usuario.
 * 
 * Tipos: 'password_changed', 'email_changed'
 */
export const onNotificacionEmail = functions
  .runWith({ secrets: ['SMTP_USER', 'SMTP_PASS'] })
  .firestore
  .document('notificacionesEmail/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { tipo, nombre, correo, nuevoCorreo } = data as Record<string, string>;

    if (!tipo) {
      console.log('⏭️ Notificación sin tipo, ignorando');
      return;
    }

    try {
      if (tipo === 'password_changed') {
        const userDoc = await admin.firestore().collection('usuarios').doc(data.uid).get();
        const userData = userDoc.data();
        const userEmail = userData?.correo || data.correo;
        if (userEmail) {
          await sendPasswordChangedEmail(userEmail, nombre || 'Usuario');
        }
      } else if (tipo === 'email_changed') {
        if (nuevoCorreo) {
          await sendEmailChangedEmail(nuevoCorreo, nombre || 'Usuario', nuevoCorreo);
        }
      }
      console.log(`✅ ${tipo} email sent for`, nombre);
    } catch (error) {
      console.error(`❌ Failed to send ${tipo} email:`, error);
    }
  });

/**
 * Envía un correo con un enlace para restablecer la contraseña.
 * Usa Firebase Admin SDK para generar el link + nuestro nodemailer para enviarlo.
 */
export const enviarCorreoRecuperacion = functions
  .runWith({ secrets: ['SMTP_USER', 'SMTP_PASS'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }

    const { email, nombre } = data;
    if (!email) {
      throw new functions.https.HttpsError('invalid-argument', 'Email es requerido');
    }

    try {
      const resetLink = await admin.auth().generatePasswordResetLink(email, {
        url: 'https://streamcontrol-10837.firebaseapp.com',
      });

      await sendResetPasswordEmail(email, nombre || 'Usuario', resetLink);

      return { success: true };
    } catch (error) {
      console.error('❌ Error sending recovery email:', error);
      throw new functions.https.HttpsError('internal', 'Error al enviar el correo de recuperación');
    }
  });
