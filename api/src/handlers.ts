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
  sendBroadcastEmail,
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
  if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
    throw new APIError('invalid-argument', 'El formato del correo electrónico no es válido');
  }

  try {
    const appUrl = APP_URL();
    let rawFirebaseLink: string;

    try {
      rawFirebaseLink = await getAdmin().auth().generatePasswordResetLink(cleanEmail, {
        url: `${appUrl}/app/reset-password`,
      });
    } catch (linkErr: unknown) {
      const err = linkErr as { code?: string; message?: string; errorInfo?: { code?: string } };
      const code = err?.code || err?.errorInfo?.code || '';
      const msg = typeof err?.message === 'string' ? err.message : '';

      if (
        code === 'auth/unauthorized-continue-uri' ||
        code === 'auth/invalid-continue-uri' ||
        code === 'auth/invalid-dynamic-link-domain' ||
        msg.includes('auth/unauthorized-continue-uri') ||
        msg.includes('auth/invalid-continue-uri') ||
        msg.includes('auth/invalid-dynamic-link-domain')
      ) {
        console.warn(`⚠️ Warning: generatePasswordResetLink failed with ${code || msg}, retrying without actionCodeSettings`);
        rawFirebaseLink = await getAdmin().auth().generatePasswordResetLink(cleanEmail);
      } else {
        throw linkErr;
      }
    }

    let customResetLink = rawFirebaseLink;
    try {
      const parsed = new URL(rawFirebaseLink);
      const oobCode = parsed.searchParams.get('oobCode');
      const apiKey = parsed.searchParams.get('apiKey') || '';
      if (oobCode) {
        customResetLink = `${appUrl}/app/reset-password?oobCode=${encodeURIComponent(oobCode)}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`;
      }
    } catch (urlErr) {
      console.warn('⚠️ Could not parse rawFirebaseLink as URL, using raw link:', urlErr);
    }

    await sendResetPasswordEmail(cleanEmail, (nombre as string) || 'Usuario', customResetLink);

    return {
      success: true,
      message: 'Si el correo está registrado, recibirás un enlace de recuperación.',
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string; errorInfo?: { code?: string } };
    const code = err?.code || err?.errorInfo?.code || '';
    const message = typeof err?.message === 'string' ? err.message : '';

    // OWASP standard: Do not leak whether the user exists or not via error / 500
    // Firebase returns code 'auth/user-not-found', 'EMAIL_NOT_FOUND', or internal assert "Unable to create the email action link" when user does not exist
    if (
      code === 'auth/user-not-found' ||
      code === 'auth/email-not-found' ||
      message.includes('auth/user-not-found') ||
      message.includes('EMAIL_NOT_FOUND') ||
      message.includes('Unable to create the email action link') ||
      message.includes('no user record')
    ) {
      console.log(`ℹ️ Password reset requested for non-existent user: ${cleanEmail}`);
      return {
        success: true,
        message: 'Si el correo está registrado, recibirás un enlace de recuperación.',
      };
    }

    if (code === 'auth/invalid-email' || message.includes('auth/invalid-email')) {
      throw new APIError('invalid-argument', 'El formato del correo electrónico no es válido');
    }

    if (error instanceof APIError) {
      throw error;
    }

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

// ─────────────────────────────────────────────────────────────────────────
// enviarComunicadoMasivo — admin (marketing, in-app y correo masivo Resend)
// ─────────────────────────────────────────────────────────────────────────

export async function enviarComunicadoMasivo(req: AuthedReq): Promise<unknown> {
  if (!req.auth) {
    throw new APIError('unauthenticated', 'Debes iniciar sesión');
  }

  const {
    titulo,
    mensaje,
    tipo = 'comunicado',
    linkBoton = '',
    textoBoton = '',
    segmento = 'todos',
    canales = { inApp: true, banner: false, email: false },
  } = dataOf(req) as {
    titulo?: string;
    mensaje?: string;
    tipo?: string;
    linkBoton?: string;
    textoBoton?: string;
    segmento?: 'todos' | 'activos' | 'por_vencer';
    canales?: { inApp?: boolean; banner?: boolean; email?: boolean };
  };

  if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
    throw new APIError('invalid-argument', 'El título del comunicado es requerido');
  }
  if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
    throw new APIError('invalid-argument', 'El mensaje del comunicado es requerido');
  }

  const cleanTitulo = titulo.trim();
  const cleanMensaje = mensaje.trim();
  const cleanTipo = tipo.trim().toLowerCase();
  const cleanLink = typeof linkBoton === 'string' ? linkBoton.trim() : '';
  const cleanTextoBoton = typeof textoBoton === 'string' ? textoBoton.trim() : '';

  const fechaIso = new Date().toISOString();

  // 1. In-App: Guardar en colección 'anunciosGlobales'
  let anuncioId: string | undefined;
  if (canales?.inApp) {
    const anuncioRef = db.collection('anunciosGlobales').doc();
    anuncioId = anuncioRef.id;
    await anuncioRef.set({
      id: anuncioId,
      titulo: cleanTitulo,
      mensaje: cleanMensaje,
      tipo: cleanTipo,
      linkBoton: cleanLink,
      textoBoton: cleanTextoBoton,
      activo: true,
      audiencia: segmento,
      canales,
      fecha: fechaIso,
      createdAt: fechaIso,
      creadoPor: req.auth.uid,
    });
  }

  // 2. Banner Superior: Actualizar 'config/broadcast' y 'configuracion/anuncioGlobal'
  if (canales?.banner) {
    const bannerPayload = {
      activo: true,
      active: true,
      mensaje: cleanMensaje,
      message: cleanMensaje,
      titulo: cleanTitulo,
      tipo: cleanTipo === 'promocion' ? 'info' : cleanTipo === 'vencimiento' ? 'warning' : cleanTipo === 'alerta' ? 'critical' : 'info',
      type: cleanTipo === 'promocion' ? 'info' : cleanTipo === 'vencimiento' ? 'warning' : cleanTipo === 'alerta' ? 'critical' : 'info',
      fecha: fechaIso,
      updatedBy: req.auth.uid,
    };
    await db.collection('config').doc('broadcast').set(bannerPayload, { merge: true });
    await db.collection('configuracion').doc('anuncioGlobal').set(bannerPayload, { merge: true }).catch(() => {});
  }

  // 3. Envío masivo por Correo Electrónico (Resend / SMTP)
  let totalDestinatarios = 0;
  let enviados = 0;
  let fallidos = 0;
  const fallidosEmails: string[] = [];

  if (canales?.email) {
    const destinatariosMap = new Map<string, { email: string; nombre: string }>();

    if (segmento === 'todos') {
      // a) De Firestore 'usuarios'
      const usersSnap = await db.collection('usuarios').get();
      usersSnap.docs.forEach((doc) => {
        const d = doc.data();
        const email = (d.correo || d.email) as string | undefined;
        if (email && email.includes('@')) {
          destinatariosMap.set(email.trim().toLowerCase(), {
            email: email.trim().toLowerCase(),
            nombre: (d.nombre as string) || 'Usuario',
          });
        }
      });

      // b) De Firebase Auth listUsers
      try {
        const auth = getAdmin().auth();
        const listAll = async (nextPageToken?: string) => {
          const authResult = await auth.listUsers(1000, nextPageToken);
          authResult.users.forEach((u) => {
            if (u.email && !destinatariosMap.has(u.email.trim().toLowerCase())) {
              destinatariosMap.set(u.email.trim().toLowerCase(), {
                email: u.email.trim().toLowerCase(),
                nombre: u.displayName || 'Usuario',
              });
            }
          });
          if (authResult.pageToken) await listAll(authResult.pageToken);
        };
        await listAll();
      } catch (authErr) {
        console.warn('⚠️ Warning listing Auth users for broadcast:', authErr);
      }
    } else if (segmento === 'activos' || segmento === 'por_vencer') {
      const subsSnap = await db.collection('suscripciones').where('estado', '==', 'activa').get();
      const ahoraMs = Date.now();
      const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

      for (const doc of subsSnap.docs) {
        const sub = doc.data();
        const uid = sub.usuarioId || sub.propietarioId;
        const subEmail = (sub.usuarioEmail || sub.correo) as string | undefined;
        const subNombre = (sub.usuarioNombre || sub.nombre || 'Usuario') as string;

        let cumple = true;
        if (segmento === 'por_vencer') {
          let finMs = 0;
          if (sub.fechaFin?.seconds) {
            finMs = sub.fechaFin.seconds * 1000;
          } else if (typeof sub.fechaFin?.toMillis === 'function') {
            finMs = sub.fechaFin.toMillis();
          } else if (typeof sub.fechaFin?.toDate === 'function') {
            finMs = sub.fechaFin.toDate().getTime();
          } else if (typeof sub.fechaFin === 'string') {
            finMs = new Date(sub.fechaFin).getTime();
          }

          if (finMs > 0) {
            const diffMs = finMs - ahoraMs;
            cumple = diffMs <= SIETE_DIAS_MS;
          }
        }

        if (cumple) {
          if (subEmail && subEmail.includes('@')) {
            destinatariosMap.set(subEmail.trim().toLowerCase(), {
              email: subEmail.trim().toLowerCase(),
              nombre: subNombre,
            });
          } else if (uid) {
            const userDoc = await db.collection('usuarios').doc(uid).get();
            if (userDoc.exists) {
              const ud = userDoc.data();
              const em = (ud?.correo || ud?.email) as string | undefined;
              if (em && em.includes('@')) {
                destinatariosMap.set(em.trim().toLowerCase(), {
                  email: em.trim().toLowerCase(),
                  nombre: (ud?.nombre as string) || subNombre,
                });
              }
            }
          }
        }
      }
    }

    const destinatarios = Array.from(destinatariosMap.values());
    totalDestinatarios = destinatarios.length;

    // Despacho en batches de 10
    const BATCH_SIZE = 10;
    for (let i = 0; i < destinatarios.length; i += BATCH_SIZE) {
      const batch = destinatarios.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((dest) =>
          sendBroadcastEmail({
            to: dest.email,
            userName: dest.nombre,
            titulo: cleanTitulo,
            mensaje: cleanMensaje,
            tipo: cleanTipo,
            linkBoton: cleanLink,
            textoBoton: cleanTextoBoton,
          })
        )
      );

      results.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          enviados++;
        } else {
          fallidos++;
          fallidosEmails.push(batch[idx].email);
          console.error(`❌ Error enviando comunicado a ${batch[idx].email}:`, res.reason);
        }
      });
    }
  }

  return {
    success: true,
    anuncioId,
    titulo: cleanTitulo,
    tipo: cleanTipo,
    segmento,
    canales,
    totalDestinatarios,
    enviados,
    fallidos,
    fallidosEmails: fallidos > 0 ? fallidosEmails : undefined,
  };
}