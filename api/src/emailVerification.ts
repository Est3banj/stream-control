/**
 * Email Verification propio: generamos token, guardamos en Firestore,
 * enviamos link, y validamos al hacer click.
 * NO dependemos de Firebase generateEmailVerificationLink.
 */

import { randomUUID } from 'crypto';
import type { AuthedReq } from './registry.js';
import { APIError } from './errors.js';
import { getDb, getAdmin } from './firebase.js';
import { sendVerificationEmail } from './email.js';
import { APP_URL } from './config.js';

const TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 horas

// ─────────────────────────────────────────────────────────────────────────
// generarTokenVerificacion — none (rate-limit email:sha256 1/60s en registry)
// ─────────────────────────────────────────────────────────────────────────

export async function generarTokenVerificacion(req: AuthedReq): Promise<unknown> {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const email = String(data.email ?? '').trim().toLowerCase();
  const nombre = String(data.nombre ?? 'Usuario');

  if (!email) {
    throw new APIError('invalid-argument', 'Email es requerido');
  }

  try {
    const db = getDb();
    const now = Date.now();

    // Buscar token existente no expirado para este email
    // NOTA: Usamos solo where('email') para evitar índice compuesto
    const existing = await db
      .collection('tokensVerificacion')
      .where('email', '==', email)
      .limit(10)
      .get();

    // Filtrar por expiración en código (evita índice compuesto)
    const validToken = existing.docs.find(d => (d.data().expira as number) > now);

    let token: string;

    if (validToken) {
      // Reusar token existente
      token = validToken.data().token as string;
    } else {
      // Generar nuevo token
      token = randomUUID();

      // Limpiar tokens viejos de este email
      const batch = db.batch();
      for (const doc of existing.docs) {
        batch.delete(doc.ref);
      }

      // Guardar nuevo token
      const tokenRef = db.collection('tokensVerificacion').doc(token);
      batch.set(tokenRef, {
        token,
        email,
        nombre,
        creado: now,
        expira: now + TOKEN_EXPIRATION_MS,
        verificado: false,
      });

      await batch.commit();
    }

    // Construir link de verificación
    const verifyLink = `${APP_URL()}/r/verificar-email?token=${token}`;

    // Enviar email
    await sendVerificationEmail(email, nombre, verifyLink);

    console.log('✅ Verification token generated and email sent to', email);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Error in generarTokenVerificacion for', email, ':', message);
    throw new APIError('internal', 'Error al enviar el correo de verificación');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// verificarEmailToken — none (valida token desde link en navegador)
// ─────────────────────────────────────────────────────────────────────────

export async function verificarEmailToken(req: AuthedReq): Promise<unknown> {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const token = String(data.token ?? '').trim();

  if (!token) {
    throw new APIError('invalid-argument', 'Token es requerido');
  }

  try {
    const db = getDb();
    const now = Date.now();

    // Buscar token en Firestore
    const tokenDoc = await db.collection('tokensVerificacion').doc(token).get();

    if (!tokenDoc.exists) {
      throw new APIError('not-found', 'Token de verificación no válido');
    }

    const tokenData = tokenDoc.data()!;

    // Verificar expiración
    if (tokenData.expira < now) {
      // Token expirado — limpiar
      await tokenDoc.ref.delete();
      throw new APIError('deadline-exceeded', 'Token expirado. Solicitá uno nuevo.');
    }

    // Verificar si ya fue verificado
    if (tokenData.verificado) {
      return { success: true, alreadyVerified: true };
    }

    // Marcar como verificado en tokensVerificacion
    await tokenDoc.ref.update({ verificado: true, verificadoEn: now });

    const email = tokenData.email as string;

    // ───────────────────────────────────────────────────────────────────
    // FIX: Buscar uid en Firestore por email (no depende de Admin SDK Auth)
    // Admin SDK no tiene permisos para getUserByEmail, así que consultamos
    // la colección usuarios directamente.
    // ───────────────────────────────────────────────────────────────────
    try {
      const usersSnap = await db
        .collection('usuarios')
        .where('correo', '==', email)
        .limit(1)
        .get();

      if (!usersSnap.empty) {
        const uid = usersSnap.docs[0].id;

        // Actualizar emailVerified en Firestore usuarios/{uid}
        await db.collection('usuarios').doc(uid).update({
          emailVerified: true,
          verificadoEn: now,
        });

        console.log('✅ Firestore usuarios/{uid} updated for', email, '(uid:', uid, ')');
      } else {
        console.warn('⚠️ No user found in Firestore for email:', email);
      }
    } catch (fsErr) {
      const msg = fsErr instanceof Error ? fsErr.message : String(fsErr);
      console.error('⚠️ Error updating Firestore usuarios for', email, ':', msg);
    }

    // Intentar actualizar Firebase Auth (best-effort, puede fallar por permisos)
    try {
      const admin = getAdmin();
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(userRecord.uid, { emailVerified: true });
      console.log('✅ Firebase Auth emailVerified updated for', email, '(uid:', userRecord.uid, ')');
    } catch (authErr) {
      const msg = authErr instanceof Error ? authErr.message : String(authErr);
      console.error('⚠️ Error updating Firebase Auth for', email, ':', msg);
      // No lanzamos error — Firestore ya se actualizó arriba
    }

    return { success: true };
  } catch (error) {
    if (error instanceof APIError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Error in verificarEmailToken:', message);
    throw new APIError('internal', 'Error al verificar el correo');
  }
}
