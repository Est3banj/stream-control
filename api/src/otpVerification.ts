import * as crypto from 'crypto';
import type { AuthedReq } from './registry.js';
import { APIError } from './errors.js';
import { getDb, getAdmin } from './firebase.js';
import { sendOtpEmail } from './email.js';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutos
const MAX_INTENTOS = 5;

export async function enviarCodigoOTP(req: AuthedReq): Promise<unknown> {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const email = String(data.email ?? '').trim().toLowerCase();
  const nombre = String(data.nombre ?? '').trim() || 'Usuario';

  if (!email || !email.includes('@')) {
    throw new APIError('invalid-argument', 'Correo electrónico inválido');
  }

  const db = getDb();
  const emailHash = crypto.createHash('sha256').update(email).digest('hex');
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  const now = Date.now();

  const otpRef = db.collection('otpsVerificacion').doc(emailHash);
  await otpRef.set({
    email,
    nombre,
    otpHash,
    expira: now + OTP_TTL_MS,
    intentos: 0,
    maxIntentos: MAX_INTENTOS,
    creado: now,
  });

  await sendOtpEmail(email, nombre, otp);

  return { success: true, message: 'Código de verificación enviado' };
}

export async function verificarCodigoOTP(req: AuthedReq): Promise<unknown> {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const email = String(data.email ?? '').trim().toLowerCase();
  const codigo = String(data.codigo ?? '').trim();

  if (!email || !codigo || codigo.length !== 6) {
    throw new APIError('invalid-argument', 'Email y código de 6 dígitos son requeridos');
  }

  const db = getDb();
  const emailHash = crypto.createHash('sha256').update(email).digest('hex');
  const otpRef = db.collection('otpsVerificacion').doc(emailHash);

  const otpDoc = await otpRef.get();
  if (!otpDoc.exists) {
    throw new APIError('not-found', 'No hay un código activo para este correo o ya expiró');
  }

  const otpData = otpDoc.data()!;
  const now = Date.now();

  if (now > otpData.expira) {
    await otpRef.delete();
    throw new APIError('deadline-exceeded', 'El código ha expirado. Solicitá uno nuevo.');
  }

  if (otpData.intentos >= otpData.maxIntentos) {
    await otpRef.delete();
    throw new APIError('resource-exhausted', 'Superaste el límite de intentos. Solicitá un nuevo código.');
  }

  const inputHash = crypto.createHash('sha256').update(codigo).digest('hex');
  if (inputHash !== otpData.otpHash) {
    const nuevosIntentos = (otpData.intentos || 0) + 1;
    if (nuevosIntentos >= otpData.maxIntentos) {
      await otpRef.delete();
      throw new APIError('resource-exhausted', 'Código incorrecto. Superaste el límite de intentos.');
    } else {
      await otpRef.update({ intentos: nuevosIntentos });
      const restantes = otpData.maxIntentos - nuevosIntentos;
      throw new APIError('invalid-argument', `Código incorrecto. Te quedan ${restantes} intento${restantes === 1 ? '' : 's'}.`);
    }
  }

  // Código válido -> actualizar usuario y eliminar OTP
  let uid = req.auth?.uid;

  if (!uid) {
    const userSnap = await db.collection('usuarios').where('correo', '==', email).limit(1).get();
    if (!userSnap.empty) {
      uid = userSnap.docs[0].id;
    }
  }

  if (!uid) {
    try {
      const admin = getAdmin();
      const userRecord = await admin.auth().getUserByEmail(email);
      if (userRecord?.uid) {
        uid = userRecord.uid;
      }
    } catch {
      // ignore
    }
  }

  if (uid) {
    await db.collection('usuarios').doc(uid).update({
      emailVerified: true,
      verificadoEn: now,
    });

    try {
      const admin = getAdmin();
      await admin.auth().updateUser(uid, { emailVerified: true });
    } catch (authErr) {
      console.warn('⚠️ Admin Auth updateUser notice (Firestore updated successfully):', authErr);
    }
  }

  await otpRef.delete();

  return { success: true, message: 'Email verificado con éxito' };
}
