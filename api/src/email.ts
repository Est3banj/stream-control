/**
 * Servicio de Email Híbrido:
 * 1. Resend REST API (vía native fetch)
 * 2. Nodemailer SMTP (fallback)
 * 3. Log en consola para dev mode
 */

import * as nodemailer from 'nodemailer';
import { EMAIL_FROM, RESEND_API_KEY, SMTP_PASS, SMTP_USER } from './config.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: SMTP_USER(),
        pass: SMTP_PASS(),
      },
    });
  }
  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Despachador de correos unificado con cascada:
 * Resend REST API -> Nodemailer SMTP -> Dev Console Mock
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const resendKey = RESEND_API_KEY();

  // 1. Prioridad: Resend REST API vía fetch nativo
  if (resendKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM(),
          to: [to],
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('❌ Resend API returned error:', response.status, errorBody);
        throw new Error(`Resend error status ${response.status}: ${errorBody}`);
      }

      console.log('✅ Email successfully sent via Resend API to', to);
      return;
    } catch (resendErr) {
      console.warn('⚠️ Resend dispatch failed, evaluating SMTP fallback...', resendErr);
      // Caída al siguiente nivel (SMTP)
    }
  }

  // 2. Fallback: Nodemailer SMTP
  const smtpUser = SMTP_USER();
  const smtpPass = SMTP_PASS();
  if (smtpUser && smtpPass) {
    try {
      await getTransporter().sendMail({
        from: EMAIL_FROM() || `"StreamControl" <${smtpUser}>`,
        to,
        subject,
        html,
      });
      console.log('✅ Email successfully sent via SMTP to', to);
      return;
    } catch (smtpErr) {
      console.error('❌ SMTP fallback failed:', smtpErr);
      throw smtpErr;
    }
  }

  // 3. Fallback: Mock para desarrollo local
  console.log('\n========================================');
  console.log('✉️  [DEV MODE EMAIL]');
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('========================================\n');
}

function buildOtpHtml(userName: string, otpCode: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 540px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px 32px; border: 1px solid #334155; text-align: center; }
    .logo { color: #6366f1; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 24px; }
    h2 { color: #f8fafc; font-size: 22px; font-weight: 700; margin: 0 0 12px 0; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; }
    .otp-box { background: #0f172a; border: 1px solid #4f46e5; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; }
    .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #818cf8; margin-left: 10px; }
    .expiry { font-size: 13px; color: #cbd5e1; margin-top: 8px; }
    .security-note { background: #1e1b4b; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #a5b4fc; text-align: left; margin: 24px 0 0 0; }
    .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">StreamControl</div>
      <h2>Tu código de verificación</h2>
      <p>Hola <strong>${userName}</strong>, ingresá el siguiente código de 6 dígitos en la aplicación para activar tu cuenta:</p>
      <div class="otp-box">
        <div class="otp-code">${otpCode}</div>
        <div class="expiry">Válido por 10 minutos</div>
      </div>
      <div class="security-note">
        <strong>Seguridad:</strong> Nunca compartas este código con nadie. El equipo de StreamControl nunca te lo solicitará.
      </div>
    </div>
    <div class="footer">
      <p>StreamControl Pro — Plataforma de Gestión de Streaming</p>
      <p>¿No solicitaste este registro? Podés ignorar este correo con total tranquilidad.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendOtpEmail(to: string, userName: string, otp: string): Promise<void> {
  await sendEmail({
    to,
    subject: `StreamControl — Tu código de verificación: ${otp}`,
    html: buildOtpHtml(userName, otp),
  });
}

function buildWelcomeHtml(userName: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f4f7f9; font-family: 'Segoe UI', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .logo { text-align: center; margin-bottom: 32px; }
    .logo h1 { color: #1a73e8; font-size: 28px; margin: 0; }
    .logo span { color: #5f6368; font-size: 14px; }
    h2 { color: #202124; font-size: 22px; margin: 0 0 12px 0; }
    p { color: #5f6368; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
    .highlight { background: #e8f0fe; border-radius: 8px; padding: 16px 20px; margin: 24px 0; }
    .highlight p { margin: 0; font-size: 14px; color: #1a73e8; }
    .highlight strong { color: #202124; }
    .btn { display: inline-block; background: #1a73e8; color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 8px 0 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e0e0e0; text-align: center; }
    .footer p { font-size: 13px; color: #9aa0a6; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>StreamControl</h1>
        <span>Streaming Control Platform</span>
      </div>
      <h2>¡Bienvenido, ${userName}!</h2>
      <p>Gracias por unirte a StreamControl. Estamos emocionados de tenerte a bordo y listos para ayudarte a gestionar tus plataformas de streaming de manera inteligente.</p>
      <div class="highlight">
        <p><strong>Plan Starter</strong> — Activo</p>
        <p>Tu plan Starter ya está disponible. Disfruta de todas las herramientas esenciales para mantener el control de tus suscripciones y notificaciones.</p>
      </div>
      <p style="text-align: center;">
        <a class="btn" href="https://streamcontrol.pro" target="_blank">Ir a StreamControl</a>
      </p>
    </div>
    <div class="footer">
      <p>StreamControl Pro — Gestiona tus plataformas de streaming</p>
      <p>¿Necesitas ayuda? Escríbenos al <strong>+57 324 734 9128</strong></p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendWelcomeEmail(to: string, userName: string): Promise<void> {
  try {
    await sendEmail({
      to,
      subject: `¡Bienvenido a StreamControl, ${userName}!`,
      html: buildWelcomeHtml(userName),
    });
    console.log('✅ Welcome email sent to', to);
  } catch (error) {
    console.error('❌ Error sending welcome email to', to, error);
  }
}

function buildPasswordChangedHtml(userName: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f4f7f9; font-family: 'Segoe UI', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .logo { text-align: center; margin-bottom: 32px; }
    .logo h1 { color: #1a73e8; font-size: 28px; margin: 0; }
    .logo span { color: #5f6368; font-size: 14px; }
    h2 { color: #202124; font-size: 22px; margin: 0 0 12px 0; }
    p { color: #5f6368; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
    .warning { background: #fef3e2; border-radius: 8px; padding: 16px 20px; margin: 24px 0; border-left: 4px solid #f9a825; }
    .warning p { margin: 0; font-size: 14px; color: #e65100; }
    .warning strong { color: #bf360c; }
    .btn { display: inline-block; background: #1a73e8; color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 8px 0 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e0e0e0; text-align: center; }
    .footer p { font-size: 13px; color: #9aa0a6; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>StreamControl</h1>
        <span>Streaming Control Platform</span>
      </div>
      <h2>Hola ${userName}, tu contraseña fue cambiada exitosamente</h2>
      <p>Te confirmamos que la contraseña de tu cuenta de StreamControl se actualizó correctamente.</p>
      <div class="warning">
        <p><strong>Importante:</strong> Si no fuiste vos quien realizó este cambio, contactá a soporte inmediatamente al <strong>+57 324 734 9128</strong> para proteger tu cuenta.</p>
      </div>
      <p style="text-align: center;">
        <a class="btn" href="https://streamcontrol.pro" target="_blank">Ir a StreamControl</a>
      </p>
    </div>
    <div class="footer">
      <p>StreamControl Pro — Gestiona tus plataformas de streaming</p>
      <p>¿Necesitas ayuda? Escríbenos al <strong>+57 324 734 9128</strong></p>
    </div>
  </div>
</body>
</html>`;
}

function buildEmailChangedHtml(userName: string, newEmail: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f4f7f9; font-family: 'Segoe UI', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .logo { text-align: center; margin-bottom: 32px; }
    .logo h1 { color: #1a73e8; font-size: 28px; margin: 0; }
    .logo span { color: #5f6368; font-size: 14px; }
    h2 { color: #202124; font-size: 22px; margin: 0 0 12px 0; }
    p { color: #5f6368; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
    .highlight { background: #e8f0fe; border-radius: 8px; padding: 16px 20px; margin: 24px 0; }
    .highlight p { margin: 0; font-size: 14px; color: #1a73e8; }
    .highlight strong { color: #202124; }
    .warning { background: #fef3e2; border-radius: 8px; padding: 16px 20px; margin: 24px 0; border-left: 4px solid #f9a825; }
    .warning p { margin: 0; font-size: 14px; color: #e65100; }
    .warning strong { color: #bf360c; }
    .btn { display: inline-block; background: #1a73e8; color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 8px 0 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e0e0e0; text-align: center; }
    .footer p { font-size: 13px; color: #9aa0a6; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>StreamControl</h1>
        <span>Streaming Control Platform</span>
      </div>
      <h2>Hola ${userName}, confirmamos que tu correo fue actualizado</h2>
      <p>Te informamos que la dirección de correo electrónico asociada a tu cuenta de StreamControl ha sido modificada exitosamente.</p>
      <div class="highlight">
        <p><strong>Nuevo correo:</strong> ${newEmail}</p>
      </div>
      <div class="warning">
        <p><strong>Importante:</strong> Si no solicitaste este cambio, contactá a soporte inmediatamente al <strong>+57 324 734 9128</strong> para proteger tu cuenta.</p>
      </div>
      <p style="text-align: center;">
        <a class="btn" href="https://streamcontrol.pro" target="_blank">Ir a StreamControl</a>
      </p>
    </div>
    <div class="footer">
      <p>StreamControl Pro — Gestiona tus plataformas de streaming</p>
      <p>¿Necesitas ayuda? Escríbenos al <strong>+57 324 734 9128</strong></p>
    </div>
  </div>
</body>
</html>`;
}

function buildResetPasswordHtml(userName: string, resetLink: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f4f7f9; font-family: 'Segoe UI', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .logo { text-align: center; margin-bottom: 32px; }
    .logo h1 { color: #1a73e8; font-size: 28px; margin: 0; }
    .logo span { color: #5f6368; font-size: 14px; }
    h2 { color: #202124; font-size: 22px; margin: 0 0 12px 0; }
    p { color: #5f6368; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
    .warning { background: #fef3e2; border-radius: 8px; padding: 16px 20px; margin: 24px 0; border-left: 4px solid #f9a825; }
    .warning p { margin: 0; font-size: 14px; color: #e65100; }
    .warning strong { color: #bf360c; }
    .btn { display: inline-block; background: #1a73e8; color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 8px 0 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e0e0e0; text-align: center; }
    .footer p { font-size: 13px; color: #9aa0a6; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>StreamControl</h1>
        <span>Streaming Control Platform</span>
      </div>
      <h2>Hola ${userName}, recibimos una solicitud para restablecer tu contraseña</h2>
      <p>Hacé clic en el botón de abajo para crear una nueva contraseña. Este enlace expira en 1 hora.</p>
      <div class="warning">
        <p><strong>Importante:</strong> Si no solicitaste esto, ignorá este mensaje. Nadie puede cambiar tu contraseña sin acceder a este enlace.</p>
      </div>
      <p style="text-align: center;">
        <a class="btn" href="${resetLink}" target="_blank">Restablecer contraseña</a>
      </p>
    </div>
    <div class="footer">
      <p>StreamControl Pro — Gestiona tus plataformas de streaming</p>
      <p>¿Necesitas ayuda? Escríbenos al <strong>+57 324 734 9128</strong></p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendPasswordChangedEmail(to: string, userName: string): Promise<void> {
  try {
    await sendEmail({
      to,
      subject: `StreamControl — Tu contraseña fue cambiada`,
      html: buildPasswordChangedHtml(userName),
    });
    console.log('✅ Password changed email sent to', to);
  } catch (error) {
    console.error('❌ Error sending password changed email to', to, error);
  }
}

export async function sendEmailChangedEmail(to: string, userName: string, newEmail: string): Promise<void> {
  try {
    await sendEmail({
      to,
      subject: `StreamControl — Tu correo fue actualizado`,
      html: buildEmailChangedHtml(userName, newEmail),
    });
    console.log('✅ Email changed email sent to', to);
  } catch (error) {
    console.error('❌ Error sending email changed email to', to, error);
  }
}

export async function sendResetPasswordEmail(to: string, userName: string, resetLink: string): Promise<void> {
  try {
    await sendEmail({
      to,
      subject: `StreamControl — Restablece tu contraseña`,
      html: buildResetPasswordHtml(userName, resetLink),
    });
    console.log('✅ Reset password email sent to', to);
  } catch (error) {
    console.error('❌ Error sending reset password email to', to, error);
    throw error;
  }
}

function buildVerificationHtml(userName: string, verifyLink: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f4f7f9; font-family: 'Segoe UI', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .logo { text-align: center; margin-bottom: 32px; }
    .logo h1 { color: #1a73e8; font-size: 28px; margin: 0; }
    .logo span { color: #5f6368; font-size: 14px; }
    h2 { color: #202124; font-size: 22px; margin: 0 0 12px 0; }
    p { color: #5f6368; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
    .highlight { background: #e8f0fe; border-radius: 8px; padding: 16px 20px; margin: 24px 0; }
    .highlight p { margin: 0; font-size: 14px; color: #1a73e8; }
    .highlight strong { color: #202124; }
    .btn { display: inline-block; background: #1a73e8; color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 8px 0 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e0e0e0; text-align: center; }
    .footer p { font-size: 13px; color: #9aa0a6; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>StreamControl</h1>
        <span>Streaming Control Platform</span>
      </div>
      <h2>Hola ${userName}, confirmá tu correo electrónico</h2>
      <p>Para activar tu cuenta de StreamControl, hacé click en el botón de abajo. El enlace es válido por un tiempo limitado.</p>
      <div class="highlight">
        <p><strong>Importante:</strong> Si no creaste una cuenta en StreamControl, podés ignorar este mensaje.</p>
      </div>
      <p style="text-align: center;">
        <a class="btn" href="${verifyLink}" target="_blank">Verificar mi correo</a>
      </p>
      <p style="text-align: center; font-size: 13px; color: #9aa0a6;">
        Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
        <span style="word-break: break-all;">${verifyLink}</span>
      </p>
    </div>
    <div class="footer">
      <p>StreamControl Pro — Gestiona tus plataformas de streaming</p>
      <p>¿Necesitas ayuda? Escríbenos al <strong>+57 324 734 9128</strong></p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendVerificationEmail(to: string, userName: string, verifyLink: string): Promise<void> {
  await sendEmail({
    to,
    subject: `StreamControl — Confirmá tu correo electrónico`,
    html: buildVerificationHtml(userName, verifyLink),
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getBroadcastBadgeInfo(tipo?: string): { label: string; bg: string; text: string; border: string } {
  switch (tipo?.toLowerCase()) {
    case 'promocion':
    case 'promo':
      return {
        label: 'Promoción Especial',
        bg: '#451a03',
        text: '#f59e0b',
        border: '#78350f',
      };
    case 'vencimiento':
    case 'vencimiento_plan':
    case 'alerta':
    case 'warning':
      return {
        label: 'Alerta de Suscripción',
        bg: '#4c0519',
        text: '#f43f5e',
        border: '#881337',
      };
    case 'novedad':
    case 'publicidad':
    case 'feature':
      return {
        label: 'Nueva Función / Novedad',
        bg: '#083344',
        text: '#06b6d4',
        border: '#155e75',
      };
    case 'comunicado':
    case 'info':
    case 'general':
    default:
      return {
        label: 'Comunicado Oficial',
        bg: '#1e1b4b',
        text: '#818cf8',
        border: '#3730a3',
      };
  }
}

export function buildBroadcastHtml(
  userName: string,
  titulo: string,
  mensaje: string,
  tipo?: string,
  linkBoton?: string,
  textoBoton?: string
): string {
  const badge = getBroadcastBadgeInfo(tipo);
  const formattedParagraphs = mensaje
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="color: #cbd5e1; font-size: 15px; line-height: 1.65; margin: 0 0 14px 0;">${escapeHtml(line)}</p>`)
    .join('');

  const ctaButtonHtml = linkBoton
    ? `
      <div style="text-align: center; margin: 32px 0 16px 0;">
        <a href="${escapeHtml(linkBoton)}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 12px; font-size: 15px; font-weight: 700; box-shadow: 0 8px 20px -4px rgba(79, 70, 229, 0.45); letter-spacing: 0.2px;">
          ${escapeHtml(textoBoton || 'Acceder ahora')} &rarr;
        </a>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(titulo)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
    .wrapper { width: 100%; background-color: #0b0f19; padding: 40px 0; }
    .container { max-width: 580px; margin: 0 auto; padding: 0 20px; }
    .card { background-color: #131b2e; border: 1px solid #23304c; border-radius: 18px; padding: 36px 32px; box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { color: #818cf8; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin: 0; text-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
    .logo-sub { color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
    .badge-container { text-align: center; margin: 20px 0 16px 0; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
    h1 { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 18px 0; text-align: center; line-height: 1.35; letter-spacing: -0.3px; }
    .user-greeting { color: #94a3b8; font-size: 15px; margin-bottom: 16px; }
    .content-box { background-color: #0c1222; border: 1px solid #1e293b; border-radius: 14px; padding: 22px 24px; margin: 18px 0; }
    .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6; }
    .footer strong { color: #94a3b8; }
    .footer-links { margin-top: 12px; }
    .footer-links a { color: #818cf8; text-decoration: none; margin: 0 8px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="card">
        <div class="header">
          <div class="logo">StreamControl Pro</div>
          <div class="logo-sub">Plataforma de Control & Streaming</div>
        </div>

        <div class="badge-container">
          <span class="badge" style="background-color: ${badge.bg}; color: ${badge.text}; border: 1px solid ${badge.border};">
            ${badge.label}
          </span>
        </div>

        <h1>${escapeHtml(titulo)}</h1>

        <div class="user-greeting">
          Hola <strong style="color: #ffffff;">${escapeHtml(userName)}</strong>,
        </div>

        <div class="content-box">
          ${formattedParagraphs}
        </div>

        ${ctaButtonHtml}
      </div>

      <div class="footer">
        <p>StreamControl Pro — Gestión Inteligente de Cuentas, Clientes y Streaming</p>
        <p>¿Tenés alguna consulta o necesitas asistencia? Escribinos a WhatsApp al <strong>+57 324 734 9128</strong></p>
        <div class="footer-links">
          <a href="https://streamcontrol.pro" target="_blank">Ir a la Plataforma</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendBroadcastEmail(options: {
  to: string;
  userName: string;
  titulo: string;
  mensaje: string;
  tipo?: string;
  linkBoton?: string;
  textoBoton?: string;
}): Promise<void> {
  await sendEmail({
    to: options.to,
    subject: `${options.titulo} — StreamControl Pro`,
    html: buildBroadcastHtml(
      options.userName,
      options.titulo,
      options.mensaje,
      options.tipo,
      options.linkBoton,
      options.textoBoton
    ),
  });
}