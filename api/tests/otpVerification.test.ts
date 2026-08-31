import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as crypto from 'crypto';
import { backend, mockFirebaseModule } from './helpers/setupFirebase.js';
import { mockFirebaseAdmin } from './helpers/firebaseAdminMock.js';
import { createApp } from '../src/app.js';

const emailMocks = vi.hoisted(() => {
  const sendMail = vi.fn(async (_mail: unknown) => ({ accepted: ['test@example.com'] }));
  return {
    sendMail,
    createTransport: vi.fn(() => ({ sendMail })),
  };
});

vi.mock('nodemailer', () => ({
  default: { createTransport: emailMocks.createTransport },
  createTransport: emailMocks.createTransport,
}));
vi.mock('../src/firebase', () => mockFirebaseModule());
vi.mock('firebase-admin', () => mockFirebaseAdmin());

const app = createApp();

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp.trim()).digest('hex');
}

describe('OTP Verification API (enviarCodigoOTP & verificarCodigoOTP)', () => {
  beforeEach(() => {
    backend.reset();
    process.env.SMTP_USER = 'smtp@example.com';
    process.env.SMTP_PASS = 'smtp-pass';
    emailMocks.sendMail.mockClear();
    emailMocks.createTransport.mockClear();
  });

  describe('POST /api/enviarCodigoOTP', () => {
    it('genera OTP, lo almacena hasheado en Firestore y despacha el correo', async () => {
      const email = 'usuario@example.com';
      const res = await request(app)
        .post('/api/enviarCodigoOTP')
        .send({ data: { email, nombre: 'Juan' } });

      expect(res.status).toBe(200);
      expect(res.body.result).toEqual({
        success: true,
        message: 'Código de verificación enviado',
      });

      // Validar almacenamiento en Firestore
      const docId = hashEmail(email);
      const otpDoc = backend.getData('otpsVerificacion', docId);
      expect(otpDoc).toBeDefined();
      expect(otpDoc?.email).toBe(email);
      expect(otpDoc?.nombre).toBe('Juan');
      expect(otpDoc?.intentos).toBe(0);
      expect(otpDoc?.maxIntentos).toBe(5);
      expect(otpDoc?.expira).toBeGreaterThan(Date.now());
      expect(typeof otpDoc?.otpHash).toBe('string');
      expect(otpDoc?.otpHash).toHaveLength(64); // SHA-256 hex length

      // Validar envío de correo
      expect(emailMocks.sendMail).toHaveBeenCalledTimes(1);
      const emailArgs = emailMocks.sendMail.mock.calls[0][0] as { to?: string; subject?: string; html?: string };
      expect(emailArgs.to).toBe(email);
      expect(emailArgs.subject).toContain('StreamControl — Tu código de verificación:');
      expect(emailArgs.html).toContain('Tu código de verificación');
      expect(emailArgs.html).toContain('Juan');
    });

    it('falla con 400 si el email es inválido o no se proporciona', async () => {
      const res1 = await request(app).post('/api/enviarCodigoOTP').send({ data: {} });
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('invalid-argument');

      const res2 = await request(app).post('/api/enviarCodigoOTP').send({ data: { email: 'not-an-email' } });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('invalid-argument');
    });

    it('aplica rate limit de 1 solicitud cada 60 segundos por email', async () => {
      const email = 'ratelimit@example.com';

      // Primera solicitud: 200 OK
      const res1 = await request(app)
        .post('/api/enviarCodigoOTP')
        .send({ data: { email } });
      expect(res1.status).toBe(200);

      // Segunda solicitud inmediata: 429 Too Many Requests
      const res2 = await request(app)
        .post('/api/enviarCodigoOTP')
        .send({ data: { email } });
      expect(res2.status).toBe(429);
      expect(res2.body.error.code).toBe('resource-exhausted');
      expect(res2.body.error.message).toContain('Esperá un minuto');
    });
  });

  describe('POST /api/verificarCodigoOTP', () => {
    const email = 'verificar@example.com';
    const rawOtp = '123456';
    const otpDocId = hashEmail(email);

    beforeEach(() => {
      backend.seed('usuarios', 'uid-123', {
        correo: email,
        nombre: 'Verif User',
        emailVerified: false,
      });

      backend.seed('otpsVerificacion', otpDocId, {
        email,
        nombre: 'Verif User',
        otpHash: hashOtp(rawOtp),
        expira: Date.now() + 10 * 60 * 1000,
        intentos: 0,
        maxIntentos: 5,
        creado: Date.now(),
      });
    });

    it('valida código correcto, actualiza Firestore + Auth y elimina el OTP', async () => {
      const res = await request(app)
        .post('/api/verificarCodigoOTP')
        .send({ data: { email, codigo: rawOtp } });

      expect(res.status).toBe(200);
      expect(res.body.result).toEqual({
        success: true,
        message: 'Email verificado con éxito',
      });

      // Verifica que el usuario en Firestore fue marcado como verificado
      const user = backend.getData('usuarios', 'uid-123');
      expect(user?.emailVerified).toBe(true);
      expect(typeof user?.verificadoEn).toBe('number');

      // Verifica llamada a admin.auth().updateUser
      expect(backend.auth.updateUser).toHaveBeenCalledWith('uid-123', { emailVerified: true });

      // Verifica eliminación del documento OTP
      expect(backend.getData('otpsVerificacion', otpDocId)).toBeUndefined();
    });

    it('falla con 400 si faltan campos o el código no tiene 6 dígitos', async () => {
      const res1 = await request(app)
        .post('/api/verificarCodigoOTP')
        .send({ data: { email } });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/verificarCodigoOTP')
        .send({ data: { email, codigo: '123' } });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('invalid-argument');
    });

    it('falla con 404 si el documento de OTP no existe', async () => {
      const res = await request(app)
        .post('/api/verificarCodigoOTP')
        .send({ data: { email: 'no-existe@example.com', codigo: '123456' } });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('not-found');
    });

    it('falla con 408 y elimina el doc si el código está expirado', async () => {
      backend.seed('otpsVerificacion', otpDocId, {
        email,
        otpHash: hashOtp(rawOtp),
        expira: Date.now() - 1000, // Expirado hace 1s
        intentos: 0,
        maxIntentos: 5,
        creado: Date.now() - 11 * 60 * 1000,
      });

      const res = await request(app)
        .post('/api/verificarCodigoOTP')
        .send({ data: { email, codigo: rawOtp } });

      expect(res.status).toBe(408);
      expect(res.body.error.code).toBe('deadline-exceeded');
      expect(backend.getData('otpsVerificacion', otpDocId)).toBeUndefined();
    });

    it('incrementa contador de intentos ante código incorrecto', async () => {
      const res = await request(app)
        .post('/api/verificarCodigoOTP')
        .send({ data: { email, codigo: '999999' } });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('invalid-argument');
      expect(res.body.error.message).toContain('4 intentos');

      const otpDoc = backend.getData('otpsVerificacion', otpDocId);
      expect(otpDoc?.intentos).toBe(1);
    });

    it('bloquea y elimina documento al alcanzar el límite de 5 intentos', async () => {
      backend.seed('otpsVerificacion', otpDocId, {
        email,
        otpHash: hashOtp(rawOtp),
        expira: Date.now() + 10 * 60 * 1000,
        intentos: 4, // Ya falló 4 veces
        maxIntentos: 5,
        creado: Date.now(),
      });

      // 5to intento fallido
      const res = await request(app)
        .post('/api/verificarCodigoOTP')
        .send({ data: { email, codigo: '999999' } });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('resource-exhausted');
      expect(res.body.error.message).toContain('Superaste el límite de intentos');

      // El documento debe ser eliminado
      expect(backend.getData('otpsVerificacion', otpDocId)).toBeUndefined();
    });
  });
});
