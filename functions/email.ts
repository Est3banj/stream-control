import * as nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
    await transporter.sendMail({
      from: `"StreamControl" <${process.env.SMTP_USER}>`,
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
        <p><strong>⚠️ Importante:</strong> Si no fuiste vos quien realizó este cambio, contactá a soporte inmediatamente al <strong>+57 324 734 9128</strong> para proteger tu cuenta.</p>
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
        <p><strong>⚠️ Importante:</strong> Si no solicitaste este cambio, contactá a soporte inmediatamente al <strong>+57 324 734 9128</strong> para proteger tu cuenta.</p>
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
        <p><strong>🔒 Importante:</strong> Si no solicitaste esto, ignorá este mensaje. Nadie puede cambiar tu contraseña sin acceder a este enlace.</p>
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
    await transporter.sendMail({
      from: `"StreamControl" <${process.env.SMTP_USER}>`,
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
    await transporter.sendMail({
      from: `"StreamControl" <${process.env.SMTP_USER}>`,
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
    await transporter.sendMail({
      from: `"StreamControl" <${process.env.SMTP_USER}>`,
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
