/**
 * Port de handlers de functions/index.ts:
 * telegramWebhook (raw), desasignarPerfil, desvincularTelegram, enviarCorreo*,
 * listarVerificados, cleanupNoVerificados + triggers post-write onNuevoUsuario
 * y onNotificacionEmail (AD-3: claim transaccional ANTES del envío).
 *
 * generarNotificacionesVencimientos NO es ruta: vive en src/crons/vencimientos.ts
 * (script de GH Actions, AD-2).
 */

import type { Response } from 'express';
import { APIError } from './errors.js';
import { getAdmin, getDb } from './firebase.js';
import { desasignarPerfil as desasignarPerfilCore } from './desasignar.js';
import { APP_URL } from './config.js';
import {
  sendEmailChangedEmail,
  sendPasswordChangedEmail,
  sendResetPasswordEmail,
  sendWelcomeEmail,
} from './email.js';
import type { AuthedReq } from './registry.js';
import * as telegram from './telegram.js';

const db = getDb();

function dataOf(req: AuthedReq): Record<string, unknown> {
  return (req.data ?? {}) as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────
// telegramWebhook — raw (sin envelope; Telegram no espera envelope)
// ─────────────────────────────────────────────────────────────────────────

export async function telegramWebhook(req: AuthedReq, res: Response): Promise<void> {
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
}

// ─────────────────────────────────────────────────────────────────────────
// onNuevoUsuario — bearer, post-write del registro (AD-3 Choice A)
// Claim transaccional emailBienvenidaEnviado ANTES del envío: 2 invocaciones
// concurrentes → 1 solo claim → 1 solo email.
// ─────────────────────────────────────────────────────────────────────────

export async function onNuevoUsuario(req: AuthedReq): Promise<unknown> {
  if (!req.auth) {
    throw new APIError('unauthenticated', 'Debes iniciar sesión');
  }

  const uid = req.auth.uid;
  const userRef = db.collection('usuarios').doc(uid);

  let claimed = false;
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists) return;
    const data = snap.data();
    if (data?.emailBienvenidaEnviado === true) return;
    transaction.update(userRef, { emailBienvenidaEnviado: true });
    claimed = true;
  });

  if (!claimed) {
    return { success: true, skipped: true };
  }

  const snap = await userRef.get();
  const userData = snap.exists ? snap.data() : null;
  const correo = (userData?.correo || userData?.email) as string | undefined;
  if (!correo) {
    console.log('⏭️ No correo field on new user doc, skipping welcome email');
    return { success: true, skipped: true };
  }

  try {
    await sendWelcomeEmail(correo, (userData?.nombre as string) || 'Usuario');
    console.log('✅ Welcome email process completed for', correo);
  } catch (error) {
    console.error('❌ Welcome email failed for', correo, error);
  }

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────
// onNotificacionEmail — bearer, post-write de notificacionesEmail (AD-3 Choice B)
// Valida doc.uid === req.auth.uid; claim transaccional procesadoEnviado.
// ─────────────────────────────────────────────────────────────────────────

export async function onNotificacionEmail(req: AuthedReq): Promise<unknown> {
  if (!req.auth) {
    throw new APIError('unauthenticated', 'Debes iniciar sesión');
  }

  const uid = req.auth.uid;
  const { notificacionId } = dataOf(req);

  if (!notificacionId) {
    throw new APIError('invalid-argument', 'notificacionId es requerido');
  }

  const docRef = db.collection('notificacionesEmail').doc(notificacionId as string);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new APIError('not-found', 'Notificación no encontrada');
  }

  const data = snap.data() as Record<string, string>;
  if (data.uid !== uid) {
    throw new APIError('permission-denied', 'No tienes permisos sobre esta notificación');
  }

  // Claim transaccional: exactamente una invocación envía
  let claimed = false;
  await db.runTransaction(async (transaction) => {
    const txSnap = await transaction.get(docRef);
    if (!txSnap.exists) return;
    const txData = txSnap.data();
    if (txData?.procesadoEnviado === true) return;
    transaction.update(docRef, { procesadoEnviado: true });
    claimed = true;
  });

  if (!claimed) {
    return { success: true, alreadyProcessed: true };
  }

  const { tipo, nombre, correo, nuevoCorreo } = data;
  if (!tipo) {
    console.log('⏭️ Notificación sin tipo, ignorando');
    return { success: true, skipped: true };
  }

  try {
    if (tipo === 'password_changed') {
      const userDoc = await db.collection('usuarios').doc(uid).get();
      const userData = userDoc.data();
      const userEmail = userData?.correo || correo;
      if (userEmail) {
        await sendPasswordChangedEmail(userEmail as string, nombre || 'Usuario');
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

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────
// desasignarPerfil — bearer
// ─────────────────────────────────────────────────────────────────────────

export async function desasignarPerfil(req: AuthedReq): Promise<unknown> {
  if (!req.auth) {
    throw new APIError('unauthenticated', 'Debes iniciar sesión');
  }

  const uid = req.auth.uid;
  const { clienteId, cuentaId, perfilNombre } = dataOf(req);

  if (!clienteId || !cuentaId || !perfilNombre) {
    throw new APIError(
      'invalid-argument',
      'Faltan campos requeridos: clienteId, cuentaId, perfilNombre'
    );
  }

  // Verificar que la cuenta pertenece al usuario
  const cuentaSnap = await db.collection('cuentas').doc(cuentaId as string).get();
  if (!cuentaSnap.exists) {
    throw new APIError('not-found', 'La cuenta no existe');
  }
  const cuenta = cuentaSnap.data()!;
  if (cuenta.propietarioId !== uid) {
    throw new APIError('permission-denied', 'No tienes permisos sobre esta cuenta');
  }

  const result = await desasignarPerfilCore(clienteId as string, cuentaId as string, perfilNombre as string);

  if (!result.success) {
    throw new APIError('internal', result.error || 'Error al desasignar el perfil');
  }

  return { success: true, perfilNombre, cuentaId };
}

// ─────────────────────────────────────────────────────────────────────────
// desvincularTelegram — bearer
// ─────────────────────────────────────────────────────────────────────────

export async function desvincularTelegram(req: AuthedReq): Promise<unknown> {
  if (!req.auth) {
    throw new APIError(
      'unauthenticated',
      'Debes iniciar sesión'
    );
  }

  const uid = req.auth.uid;

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
    throw new APIError(
      'internal',
      'Error al desvincular Telegram'
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// enviarCorreoRecuperacion — none (rate-limit email:sha256 1/60s en registry)
// ─────────────────────────────────────────────────────────────────────────

export async function enviarCorreoRecuperacion(req: AuthedReq): Promise<unknown> {
  const { email, nombre } = dataOf(req);
  if (!email) {
    throw new APIError('invalid-argument', 'Email es requerido');
  }

  const cleanEmail = String(email).trim().toLowerCase();

  try {
    const appUrl = APP_URL();
    const rawFirebaseLink = await getAdmin().auth().generatePasswordResetLink(cleanEmail, {
      url: `${appUrl}/app/reset-password`,
    });

    const parsed = new URL(rawFirebaseLink);
    const oobCode = parsed.searchParams.get('oobCode');
    const apiKey = parsed.searchParams.get('apiKey') || '';
    // Direct link to our own custom page in the SPA namespace
    const customResetLink = `${appUrl}/app/reset-password?oobCode=${encodeURIComponent(oobCode || '')}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`;

    await sendResetPasswordEmail(cleanEmail, (nombre as string) || 'Usuario', customResetLink);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending recovery email:', error);
    throw new APIError('internal', 'Error al enviar el correo de recuperación');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// notificarPasswordReseteado — none (rate-limit email:sha256 en registry)
// ─────────────────────────────────────────────────────────────────────────

export async function notificarPasswordReseteado(req: AuthedReq): Promise<unknown> {
  const { email, nombre } = dataOf(req);
  if (!email) {
    throw new APIError('invalid-argument', 'Email es requerido');
  }

  const cleanEmail = String(email).trim().toLowerCase();
  let userName = (typeof nombre === 'string' && nombre.trim()) ? nombre.trim() : '';

  if (!userName) {
    try {
      const usersSnap = await db
        .collection('usuarios')
        .where('correo', '==', cleanEmail)
        .limit(1)
        .get();

      if (!usersSnap.empty) {
        userName = (usersSnap.docs[0].data().nombre as string) || '';
      } else {
        const usersSnapEmail = await db
          .collection('usuarios')
          .where('email', '==', cleanEmail)
          .limit(1)
          .get();
        if (!usersSnapEmail.empty) {
          userName = (usersSnapEmail.docs[0].data().nombre as string) || '';
        }
      }

      if (!userName) {
        try {
          const admin = getAdmin();
          const userRecord = await admin.auth().getUserByEmail(cleanEmail);
          if (userRecord?.displayName) {
            userName = userRecord.displayName;
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.warn('⚠️ Error searching user name for password reset notification:', e);
    }
  }

  try {
    await sendPasswordChangedEmail(cleanEmail, userName || 'Usuario');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending password changed notification email:', error);
    throw new APIError('internal', 'Error al enviar la notificación de cambio de contraseña');
  }
}


// ─────────────────────────────────────────────────────────────────────────
// listarVerificados — admin (rol: claims + fallback Firestore, en app.ts)
// ─────────────────────────────────────────────────────────────────────────

export async function listarVerificados(req: AuthedReq): Promise<unknown> {
  if (!req.auth) {
    throw new APIError('unauthenticated', 'Debes iniciar sesión');
  }

  const mapa: Record<string, boolean> = {};
  const listAll = async (nextPageToken?: string) => {
    const result = await getAdmin().auth().listUsers(1000, nextPageToken);
    result.users.forEach(u => { mapa[u.uid] = u.emailVerified; });
    if (result.pageToken) await listAll(result.pageToken);
  };
  await listAll();

  return { verificados: mapa };
}

// ─────────────────────────────────────────────────────────────────────────
// cleanupNoVerificados — cron (x-cron-secret en registry)
// ─────────────────────────────────────────────────────────────────────────

export async function cleanupNoVerificados(): Promise<unknown> {
  const ahora = Date.now();
  const LIMITE_MS = 3 * 24 * 60 * 60 * 1000; // 3 días

  let eliminados = 0;
  let candidatos = 0;

  const auth = getAdmin().auth();
  const listAll = async (nextPageToken?: string) => {
    const result = await auth.listUsers(1000, nextPageToken);
    for (const u of result.users) {
      // Solo email/password sin verificar
      if (u.emailVerified) continue;
      if (!u.providerData.some(p => p.providerId === 'password')) continue;

      // Solo creados hace más de 3 días
      const createdAt = u.metadata.creationTime ? new Date(u.metadata.creationTime).getTime() : 0;
      if (!createdAt || ahora - createdAt < LIMITE_MS) continue;

      candidatos++;

      // Exento: admins
      const snap = await db.collection('usuarios').doc(u.uid).get();
      if (snap.exists && snap.data()?.rol === 'admin') continue;

      // Eliminar de Auth y Firestore
      await auth.deleteUser(u.uid);
      await snap.ref.delete().catch(() => {});
      eliminados++;
    }
    if (result.pageToken) await listAll(result.pageToken);
  };

  await listAll();
  console.log(`cleanupNoVerificados: ${eliminados} eliminados, ${candidatos} candidatos`);
  return { eliminados, candidatos };
}