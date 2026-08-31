/**
 * Cloud Functions para StreamControl Pro
 * 
 * Función programada que genera notificaciones automáticas
 * cuando los clientes están próximos a vencer (1, 2 o 3 días)
 */

import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as telegram from './telegram';
import { APP_URL } from './telegram';
import { sendWelcomeEmail, sendPasswordChangedEmail, sendEmailChangedEmail, sendResetPasswordEmail, sendVerificationEmail } from './email';
import { desasignarPerfil as desasignarPerfilCore, limpiarPerfilesVencidos } from './src/desasignar';
export { generarToken, validarToken, consultarCodigo, guardarCredenciales, toggleToken, consultarCodigoDirecto, generarTokenSubdistribuidor, obtenerCredencialesCuenta } from './src/codigos';

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
export const telegramWebhook = onRequest(
  { secrets: ['TELEGRAM_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'] },
  async (req, res) => {
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
export const onNuevoUsuario = onDocumentCreated(
  { document: 'usuarios/{uid}', secrets: ['SMTP_USER', 'SMTP_PASS'] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
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
export const generarNotificacionesVencimientos = onSchedule(
  { schedule: 'every 24 hours', timeZone: 'America/Bogota', secrets: ['TELEGRAM_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'] },
  async () => {
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
      let batch = db.batch();
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
                batch = db.batch();
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
              batch = db.batch();
              batchCount = 0;
            }
          }
        }
      }

      // ── Procesar suscripciones próximas a vencer ──
      const suscripcionesSnapshot = await db.collection('suscripciones')
        .where('estado', '==', 'activa')
        .get();

      let autoExpiradas = 0;

      for (const susDoc of suscripcionesSnapshot.docs) {
        const sus = susDoc.data() as admin.firestore.DocumentData;
        const fechaFin = (sus.fechaFin as admin.firestore.Timestamp).toDate();
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
              batch = db.batch();
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
              batch = db.batch();
              batchCount = 0;
            }
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      // ── Auto-cleanup: liberar perfiles de clientes vencidos (1 día de gracia / fechaVencimiento < hoy) ──
      const perfilesLiberados = await limpiarPerfilesVencidos(0);
      if (perfilesLiberados > 0) {
        console.log(`${perfilesLiberados} perfil(es) liberado(s) automáticamente`);
      }

      console.log(`${notificacionesCreadas} notifs Firestore, ${telegramEnviados} Telegram vencimientos, ${morasNotificadas} Telegram moras, ${autoExpiradas} suscripciones auto-expiradas, ${perfilesLiberados} perfiles liberados`);
    } catch (error) {
      console.error('❌ Error generando notificaciones:', error);
      throw error;
    }
  });

/**
 * Cloud Function para desasignar manualmente un perfil de un cliente.
 * 
 * Llamada desde el botón "Liberar perfil" en GestionClientes.
 * Usa Admin SDK (bypasea reglas de Firestore).
 */
export const desasignarPerfil = onCall(
  { timeoutSeconds: 30, memory: '256MiB' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
    }

    const uid = request.auth.uid;
    const { clienteId, cuentaId, perfilNombre } = request.data || {};

    if (!clienteId || !cuentaId || !perfilNombre) {
      throw new HttpsError(
        'invalid-argument',
        'Faltan campos requeridos: clienteId, cuentaId, perfilNombre'
      );
    }

    // Verificar que la cuenta pertenece al usuario
    const cuentaSnap = await admin.firestore().collection('cuentas').doc(cuentaId).get();
    if (!cuentaSnap.exists) {
      throw new HttpsError('not-found', 'La cuenta no existe');
    }
    const cuenta = cuentaSnap.data()!;
    if (cuenta.propietarioId !== uid) {
      throw new HttpsError('permission-denied', 'No tienes permisos sobre esta cuenta');
    }

    const result = await desasignarPerfilCore(clienteId, cuentaId, perfilNombre);

    if (!result.success) {
      throw new HttpsError('internal', result.error || 'Error al desasignar el perfil');
    }

    return { success: true, perfilNombre, cuentaId };
  });

/**
 * Desvincula la cuenta de Telegram del usuario autenticado.
 * Usa Admin SDK para bypassear Firestore Rules (la colección vinculaciones
 * solo permite delete via Admin SDK por seguridad).
 * 
 * Llamada desde TelegramConfig.tsx.
 */
export const desvincularTelegram = onCall(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Debes iniciar sesión'
      );
    }

    const uid = request.auth.uid;

    try {
      const snapshot = await db
        .collection('vinculaciones')
        .where('uid', '==', uid)
        .get();

      if (snapshot.empty) {
        // Idempotente: si ya está desvinculado, no es error
        return { success: true, alreadyUnlinked: true };
      }

      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      const result: { success: boolean; multipleDeleted?: boolean } = { success: true };
      if (snapshot.docs.length > 1) {
        result.multipleDeleted = true;
      }

      return result;
    } catch (error) {
      console.error('Error desvinculando Telegram:', error);
      throw new HttpsError(
        'internal',
        'Error al desvincular Telegram'
      );
    }
  });

/**
 * Cuando se crea una notificación de cambio en notificacionesEmail,
 * envía un email de confirmación al usuario.
 * 
 * Tipos: 'password_changed', 'email_changed'
 */
export const onNotificacionEmail = onDocumentCreated(
  { document: 'notificacionesEmail/{docId}', secrets: ['SMTP_USER', 'SMTP_PASS'] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
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
// Rate limiting simple para recovery emails (en memoria, por email)
const recoveryRateLimit = new Map<string, number>();

export const enviarCorreoRecuperacion = onCall(
  { secrets: ['SMTP_USER', 'SMTP_PASS'] },
  async (request) => {
    const { email, nombre } = request.data;
    if (!email) {
      throw new HttpsError('invalid-argument', 'Email es requerido');
    }

    // Rate limiting: max 1 recovery email por email cada 60 segundos
    const ahora = Date.now();
    const ultimoEnvio = recoveryRateLimit.get(email);
    if (ultimoEnvio && ahora - ultimoEnvio < 60_000) {
      throw new HttpsError(
        'resource-exhausted',
        'Esperá un minuto antes de solicitar otro correo de recuperación'
      );
    }
    recoveryRateLimit.set(email, ahora);

    try {
      const appUrl = APP_URL.value();
      const rawFirebaseLink = await admin.auth().generatePasswordResetLink(email, {
        url: `${appUrl}/reset-password`,
      });
      const parsed = new URL(rawFirebaseLink);
      const oobCode = parsed.searchParams.get('oobCode');
      const apiKey = parsed.searchParams.get('apiKey') || '';
      // Direct link to our own custom page
      const customResetLink = `${appUrl}/reset-password?oobCode=${encodeURIComponent(oobCode || '')}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`;

      await sendResetPasswordEmail(email, nombre || 'Usuario', customResetLink);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending recovery email:', error);
      throw new HttpsError('internal', 'Error al enviar el correo de recuperación');
    }
  });

/**
 * Envía un correo con un enlace para verificar la cuenta.
 * Se usa cuando un usuario reenvía el link de verificación
 * desde la pantalla "Verificá tu correo".
 */
// Rate limiting simple para verification emails (en memoria, por email)
const verificationRateLimit = new Map<string, number>();

export const enviarCorreoVerificacion = onCall(
  { secrets: ['SMTP_USER', 'SMTP_PASS'] },
  async (request) => {
    const { email, nombre } = request.data;
    if (!email) {
      throw new HttpsError('invalid-argument', 'Email es requerido');
    }

    // Rate limiting: max 1 verification email por email cada 60 segundos
    const ahora = Date.now();
    const ultimoEnvio = verificationRateLimit.get(email);
    if (ultimoEnvio && ahora - ultimoEnvio < 60_000) {
      throw new HttpsError(
        'resource-exhausted',
        'Esperá un minuto antes de reenviar el correo de verificación'
      );
    }
    verificationRateLimit.set(email, ahora);

    try {
      const verifyLink = await admin.auth().generateEmailVerificationLink(email, {
        url: 'https://streamcontrol-10837.firebaseapp.com',
      });

      await sendVerificationEmail(email, nombre || 'Usuario', verifyLink);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      console.error('❌ Error sending verification email:', message);

      // Firebase Auth limita la generación de links (TOO_MANY_ATTEMPTS_TRY_LATER)
      if (message.includes('TOO_MANY_ATTEMPTS')) {
        throw new HttpsError(
          'resource-exhausted',
          'Demasiados intentos. Esperá unos minutos y volvé a intentar.'
        );
      }

      throw new HttpsError('internal', 'Error al enviar el correo de verificación');
    }
  });

/**
 * Devuelve el mapa uid -> emailVerified de todos los usuarios de Auth.
 * Solo admin. Se usa en Usuarios.tsx para mostrar el badge de verificación.
 */
export const listarVerificados = onCall(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
    }
    if (request.auth.token.role !== 'admin') {
      // Fallback: chequear Firestore si el claim no está
      const snap = await admin.firestore().collection('usuarios').doc(request.auth.uid).get();
      if (!snap.exists || snap.data()?.rol !== 'admin') {
        throw new HttpsError('permission-denied', 'Solo admin puede listar verificados');
      }
    }

    const mapa: Record<string, boolean> = {};
    const listAll = async (nextPageToken?: string) => {
      const result = await admin.auth().listUsers(1000, nextPageToken);
      result.users.forEach(u => { mapa[u.uid] = u.emailVerified; });
      if (result.pageToken) await listAll(result.pageToken);
    };
    await listAll();

    return { verificados: mapa };
  });

/**
 * Cron diario: elimina usuarios que se registraron con email/password
 * y nunca verificaron su correo después de 3 días.
 *
 * Evita que correos ficticios queden ocupados en Firebase Auth para siempre.
 * Exentos: admins (rol 'admin') y cuentas de Google (emailVerified true de origen).
 */
export const cleanupNoVerificados = onSchedule(
  { schedule: 'every 24 hours', timeZone: 'America/Bogota' },
  async () => {
    const ahora = Date.now();
    const LIMITE_MS = 3 * 24 * 60 * 60 * 1000; // 3 días

    let eliminados = 0;
    let candidatos = 0;

    const listAll = async (nextPageToken?: string) => {
      const result = await admin.auth().listUsers(1000, nextPageToken);
      for (const u of result.users) {
        // Solo email/password sin verificar
        if (u.emailVerified) continue;
        if (!u.providerData.some(p => p.providerId === 'password')) continue;

        // Solo creados hace más de 3 días
        const createdAt = u.metadata.creationTime ? new Date(u.metadata.creationTime).getTime() : 0;
        if (!createdAt || ahora - createdAt < LIMITE_MS) continue;

        candidatos++;

        // Exento: admins
        const snap = await admin.firestore().collection('usuarios').doc(u.uid).get();
        if (snap.exists && snap.data()?.rol === 'admin') continue;

        // Eliminar de Auth y Firestore
        await admin.auth().deleteUser(u.uid);
        await snap.ref.delete().catch(() => {});
        eliminados++;
      }
      if (result.pageToken) await listAll(result.pageToken);
    };

    await listAll();
    console.log(`cleanupNoVerificados: ${eliminados} eliminados, ${candidatos} candidatos`);
  });
