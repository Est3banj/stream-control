/**
 * Port de functions/telegram.ts — defineSecret/defineString → process.env (vía config.ts).
 * Lógica del bot y verifyWebhook INTACTAS.
 */

import admin from 'firebase-admin'; // default import: el namespace `import *` NO expone firestore/apps en ESM (runtime)
import * as crypto from 'crypto';
import { APP_URL, TELEGRAM_TOKEN, TELEGRAM_WEBHOOK_SECRET } from './config.js';
import { getDb } from './firebase.js';

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: string;
  reply_markup?: object;
}

interface WebhookResult {
  success: boolean;
  message: string;
}

interface UpdateResult {
  status: string;
  action?: string;
  reason?: string;
  success?: boolean;
}

export interface NotificacionPayload {
  clienteId: string;
  nombreCliente: string;
  plataforma: string;
  diasRestantes: number;
  fechaVencimiento?: string;
  propietarioId: string;
  telefono?: string;
  correo?: string;
  perfilAsignado?: string;
  pantallas?: number;
  saldoPendiente?: number;
  esMayorista?: boolean;
}

function escapeHtml(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface NotificacionOptions {
  appUrl?: string;
}

interface SuscripcionNotificacionPayload {
  usuarioNombre: string;
  planNombre: string;
  fechaFin: { toDate(): Date };
  diasRestantes: number;
  estado: string;
}

const db = getDb();

// ============================================================
// CONFIGURACIÓN (process.env — reemplaza params/secrets v2)
// ============================================================

const BOT_TOKEN = () => TELEGRAM_TOKEN();
const WEBHOOK_SECRET = () => TELEGRAM_WEBHOOK_SECRET();
const TELEGRAM_API = 'https://api.telegram.org/bot';

// ============================================================
// TELEGRAM API HELPERS
// ============================================================

/**
 * Formatea un número de teléfono para wa.me
 * - El `+` es OBLIGATORIO en nuevos registros (validación: /^\+[1-9]\d{6,14}$/)
 * - Si empieza con '+' → usa el código de país explícito
 * - Si no → asume Colombia (backward compat con datos existentes sin código de país)
 */
function formatWaNumber(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith('+')) return raw.replace(/[^0-9]/g, '');
  // Legacy: sin + → asume Colombia
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return `57${digits}`;
}

export async function sendMessage(chatId: string, text: string, extra: Record<string, unknown> = {}): Promise<unknown> {
  const token = BOT_TOKEN();
  if (!token) throw new Error('TELEGRAM_TOKEN_NO_CONFIGURED');

  const url = `${TELEGRAM_API}${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`❌ Telegram sendMessage error [${response.status}]:`, err);
    throw new Error(`Telegram API error: ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

export function verifyWebhook(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const secret = WEBHOOK_SECRET();
  if (!secret) return true;

  const headerSecret = (req.headers as Record<string, string>)['x-telegram-bot-api-secret-token'];
  return headerSecret === secret;
}

// ============================================================
// LÓGICA DE VINCULACIÓN
// ============================================================

export async function generarCodigo(uid: string): Promise<string> {
  const codigosExistentes = await db
    .collection('codigosVinculacion')
    .where('uid', '==', uid)
    .where('expirado', '==', false)
    .get();

  const batch = db.batch();
  codigosExistentes.forEach(doc => {
    batch.update(doc.ref, { expirado: true });
  });
  await batch.commit();

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const randomBytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[randomBytes[i] % chars.length];
  }

  const ahora = admin.firestore.Timestamp.now();
  const expiraEn = new Date(ahora.toMillis() + 15 * 60 * 1000);

  await db.collection('codigosVinculacion').doc(code).set({
    uid,
    createdAt: ahora,
    expiresAt: admin.firestore.Timestamp.fromDate(expiraEn),
    expirado: false,
  });

  return code;
}

export async function procesarCodigo(codigo: string, chatId: string, telegramUsername = ''): Promise<WebhookResult> {
  const docRef = db.collection('codigosVinculacion').doc(codigo);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return { success: false, message: '❌ Código inválido. Verificá que sea correcto o generá uno nuevo en la app.' };
  }

  const data = docSnap.data() as admin.firestore.DocumentData;

  if (data.expirado) {
    return { success: false, message: '⏰ Este código ya fue usado o está vencido. Generá uno nuevo en la app.' };
  }

  const ahora = admin.firestore.Timestamp.now();
  if (data.expiresAt.toMillis() < ahora.toMillis()) {
    await docRef.update({ expirado: true });
    return { success: false, message: '⏰ El código expiró. Generá uno nuevo en la app (tienen validez de 15 minutos).' };
  }

  await db.collection('vinculaciones').doc(String(chatId)).set({
    uid: data.uid,
    telegramChatId: String(chatId),
    telegramUsername: telegramUsername || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await docRef.update({ expirado: true });

  return { success: true, message: '✅ ¡Vinculación exitosa! A partir de ahora recibirás notificaciones de tus clientes aquí.' };
}

export async function eliminarVinculacion(chatId: string): Promise<void> {
  await db.collection('vinculaciones').doc(String(chatId)).delete();
}

export async function getChatIdPorUid(uid: string): Promise<string | null> {
  const snapshot = await db
    .collection('vinculaciones')
    .where('uid', '==', uid)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return (snapshot.docs[0].data() as admin.firestore.DocumentData).telegramChatId as string;
}

export async function tieneVinculacion(uid: string): Promise<boolean> {
  const chatId = await getChatIdPorUid(uid);
  return chatId !== null;
}

// ============================================================
// MANEJO DE COMANDOS DEL BOT
// ============================================================

export async function handleUpdate(update: Record<string, unknown>): Promise<UpdateResult> {
  const message = update.message as Record<string, unknown> | undefined;
  if (!message) return { status: 'ignored', reason: 'no_message' };

  const chatId = message.chat as Record<string, unknown>;
  const chatIdStr = String(chatId.id);
  const text = ((message.text as string) || '').trim();
  const username = (message.from as Record<string, unknown> | undefined)?.username as string || '';

  if (text === '/start') {
    await sendMessage(chatIdStr,
      `👋 <b>¡Bienvenido a StreamControl Pro!</b>\n\n` +
      `Soy el bot de notificaciones para vendedores. Te avisaré cuando los servicios de tus clientes estén por vencer.\n\n` +
      `📌 <b>¿Cómo vincular tu cuenta?</b>\n` +
      `1. Abrí la app de StreamControl\n` +
      `2. Andá a Configuración → Conectar Telegram\n` +
      `3. Generá un código de vinculación\n` +
      `4. Enviame ese código acá\n\n` +
      `🔐 Los códigos expiran a los 15 minutos por seguridad.\n\n` +
      `<i>Comandos disponibles:</i>\n` +
      `/ayuda - Mostrar esta ayuda\n` +
      `/desvincular - Desconectar tu cuenta de Telegram`
    );
    return { status: 'ok', action: 'start' };
  }

  if (text === '/ayuda' || text === '/help') {
    await sendMessage(chatIdStr,
      `<b>🤖 Ayuda - StreamControl Bot</b>\n\n` +
      `<b>¿Cómo vincular?</b>\n` +
      `En la app web, andá a <b>Configuración → Conectar Telegram</b> y generá un código. Luego enviame ese código.\n\n` +
      `<b>¿Qué notificaciones voy a recibir?</b>\n` +
      `• Clientes con servicios próximos a vencer\n` +
      `• Clientes con pagos pendientes\n` +
      `• Recordatorios automáticos diarios\n\n` +
      `<b>Comandos:</b>\n` +
      `/start - Mensaje de bienvenida\n` +
      `/desvincular - Desconectar Telegram\n` +
      `/ayuda - Esta ayuda`
    );
    return { status: 'ok', action: 'help' };
  }

  if (text === '/desvincular' || text === '/unlink') {
    const vinculacion = await db.collection('vinculaciones').doc(String(chatIdStr)).get();
    if (!vinculacion.exists) {
      await sendMessage(chatIdStr, 'ℹ️ No hay ninguna cuenta vinculada a este chat.');
      return { status: 'ok', action: 'unlink_not_found' };
    }
    await eliminarVinculacion(chatIdStr);
    await sendMessage(chatIdStr, '✅ <b>Cuenta desvinculada.</b> Ya no recibirás notificaciones aquí. Podés volver a vincular cuando quieras.');
    return { status: 'ok', action: 'unlinked' };
  }

  if (/^[A-Za-z0-9]{8}$/.test(text)) {
    const result = await procesarCodigo(text, chatIdStr, username);
    await sendMessage(chatIdStr, result.message);
    return { status: 'ok', action: 'code_processed', success: result.success };
  }

  await sendMessage(chatIdStr,
    `❌ No entendí ese mensaje.\n\n` +
    `📌 Si tenés un código de vinculación, enviámelo tal cual aparece en la app.\n` +
    `📌 Usá /ayuda para ver los comandos disponibles.`
  );
  return { status: 'ok', action: 'unknown_command' };
}

// ============================================================
// NOTIFICACIONES
// ============================================================

export function formatearPlataformaConDetalles(
  plataforma?: string,
  correo?: string,
  perfilAsignado?: string,
  pantallas?: number,
  esMayorista?: boolean
): string {
  const plat = plataforma || 'streaming';
  const detalles: string[] = [];
  if (correo) {
    detalles.push(`Cuenta: ${correo}`);
  }
  if (esMayorista || (pantallas && pantallas > 1)) {
    detalles.push(`${pantallas || 1} pantallas`);
  } else if (perfilAsignado) {
    detalles.push(`Perfil: ${perfilAsignado}`);
  }
  return detalles.length > 0 ? `${plat} (${detalles.join(' - ')})` : plat;
}

export async function enviarNotificacionVencimiento(notificacion: NotificacionPayload, options: NotificacionOptions = {}): Promise<boolean> {
  try {
    const chatId = await getChatIdPorUid(notificacion.propietarioId);
    if (!chatId) return false;

    const estadoVencido = notificacion.diasRestantes <= 0;
    const diasTexto = estadoVencido
      ? `⚠️ <b>VENCIDO</b> hace ${Math.abs(notificacion.diasRestantes)} día(s)`
      : `⏱️ Vence en <b>${notificacion.diasRestantes}</b> día(s)`;

    const lines: string[] = [
      `<b>⏰ Recordatorio de servicio</b>\n`,
      `👤 <b>Cliente:</b> ${escapeHtml(notificacion.nombreCliente)}`,
    ];

    if (notificacion.telefono) {
      lines.push(`📞 <b>Teléfono:</b> ${escapeHtml(notificacion.telefono)}`);
    }

    lines.push(`📺 <b>Servicio:</b> ${escapeHtml(notificacion.plataforma || '—')}`);

    if (notificacion.correo) {
      lines.push(`📧 <b>Cuenta:</b> <code>${escapeHtml(notificacion.correo)}</code>`);
    }

    if (notificacion.esMayorista || (notificacion.pantallas && notificacion.pantallas > 1)) {
      lines.push(`📦 <b>Lote:</b> ${notificacion.pantallas || 1} pantallas (Mayorista)`);
    } else if (notificacion.perfilAsignado) {
      lines.push(`📌 <b>Perfil:</b> ${escapeHtml(notificacion.perfilAsignado)}`);
    }

    if (notificacion.fechaVencimiento) {
      lines.push(`📅 <b>Vence:</b> ${escapeHtml(notificacion.fechaVencimiento)}`);
    }

    lines.push(diasTexto);

    if (notificacion.saldoPendiente && notificacion.saldoPendiente > 0) {
      lines.push(`💵 <b>Saldo pendiente:</b> <b>$${Number(notificacion.saldoPendiente).toLocaleString('es-CO')}</b>`);
    }

    lines.push(`\n<i>Contactá al cliente para consultar si desea renovar. Si no renueva, marcalo como inactivo desde la app.</i>`);

    const mensaje = lines.join('\n');

    const platConDetalles = formatearPlataformaConDetalles(
      notificacion.plataforma,
      notificacion.correo,
      notificacion.perfilAsignado,
      notificacion.pantallas,
      notificacion.esMayorista
    );

    const waMensaje = estadoVencido
      ? `Hola ${notificacion.nombreCliente},\n\nTe recordamos que tu servicio de *${platConDetalles}* se encuentra VENCIDO desde el *${notificacion.fechaVencimiento || ''}*.\n\n¿Deseas reactivar tu cuenta para mantener tu perfil y servicio activo?\n\nQuedamos atentos a tu confirmación. Saludos.`
      : `Hola ${notificacion.nombreCliente},\n\nTe recordamos que tu servicio de *${platConDetalles}* está próximo a vencer el *${notificacion.fechaVencimiento || ''}*.\n\n¿Deseas renovarlo para seguir disfrutando sin interrupciones?\n\nQuedamos atentos a tu confirmación. ¡Muchas gracias!`;

    const waTexto = encodeURIComponent(waMensaje);

    const reply_markup = {
      inline_keyboard: [
        [
          { text: '📱 Contactar', url: `https://wa.me/${formatWaNumber(notificacion.telefono || '')}?text=${waTexto}` },
        ],
        [
          { text: '👤 Ver cliente', url: `${options.appUrl || ''}/gestion-clientes` },
        ],
      ],
    };

    await sendMessage(chatId, mensaje, { reply_markup });
    return true;
  } catch (error) {
    console.error(`❌ Error enviando notif Telegram a ${notificacion.propietarioId}:`, error);
    return false;
  }
}

export async function enviarNotificacionSuscripcion(
  suscripcion: SuscripcionNotificacionPayload,
  options: NotificacionOptions = {}
): Promise<boolean> {
  try {
    // Solo enviar a admins (las suscripciones no son para usuarios regulares)
    const usersSnapshot = await db.collection('usuarios')
      .where('rol', '==', 'admin')
      .get();

    if (usersSnapshot.empty) return false;

    // Obtener los chatIds de los admins que tienen Telegram vinculado
    const adminUids = usersSnapshot.docs.map(d => d.id);
    const vinculacionesSnapshot = await db.collection('vinculaciones')
      .where('uid', 'in', adminUids)
      .get();

    if (vinculacionesSnapshot.empty) return false;

    const estadoVencido = suscripcion.diasRestantes <= 0;
    const fechaFinDate = suscripcion.fechaFin.toDate();
    const fechaFinStr = `${fechaFinDate.getDate()}/${fechaFinDate.getMonth() + 1}/${fechaFinDate.getFullYear()}`;
    const estadoTexto = estadoVencido
      ? `⚠️ <b>VENCIDA</b> hace ${Math.abs(suscripcion.diasRestantes)} día(s)`
      : `📅 Vence en <b>${suscripcion.diasRestantes}</b> día(s)`;

    const mensaje =
      `<b>⏰ Recordatorio de suscripción</b>\n\n` +
      `👤 <b>Usuario:</b> ${suscripcion.usuarioNombre}\n` +
      `📺 <b>Plan:</b> ${suscripcion.planNombre}\n` +
      `📅 <b>Fecha de fin:</b> ${fechaFinStr}\n` +
      `${estadoTexto}\n\n` +
      `<i>Gestioná la suscripción desde el panel de administración.</i>`;

    const reply_markup = {
      inline_keyboard: [
        [
          { text: '👤 Ver suscripciones', url: `${options.appUrl || ''}/admin/suscripciones` },
        ],
      ],
    };

    let sentCount = 0;
    for (const doc of vinculacionesSnapshot.docs) {
      const chatId = doc.data().telegramChatId as string;
      if (!chatId) continue;
      try {
        await sendMessage(chatId, mensaje, { reply_markup });
        sentCount++;
      } catch (err) {
        console.error(`Error enviando notif suscripción a chat ${chatId}:`, err);
      }
    }

    return sentCount > 0;
  } catch (error) {
    console.error('❌ Error enviando notif suscripción Telegram:', error);
    return false;
  }
}

interface CuentaNotificacionPayload {
  proveedor: string;
  correoCuenta: string;
  diasRestantes: number;
  fechaVencimiento: string;
  propietarioId: string;
}

export async function enviarNotificacionCuentaVencimiento(cuenta: CuentaNotificacionPayload, options: NotificacionOptions = {}): Promise<boolean> {
  try {
    const chatId = await getChatIdPorUid(cuenta.propietarioId);
    if (!chatId) return false;

    const estado = cuenta.diasRestantes <= 0 ? '⚠️ VENCIDA' : '📅 Por vencer';
    const mensaje =
      `<b>📺 Recordatorio de cuenta</b>\n\n` +
      `🎬 <b>Proveedor:</b> ${cuenta.proveedor}\n` +
      `📧 <b>Correo:</b> ${cuenta.correoCuenta}\n` +
      `📅 <b>Vence:</b> ${cuenta.fechaVencimiento}\n` +
      `<b>⏱️ ${cuenta.diasRestantes > 0 ? `Expira en ${cuenta.diasRestantes} día(s)` : `VENCIDA hace ${Math.abs(cuenta.diasRestantes)} día(s)`}</b>\n\n` +
      `<i>Revisá si es necesario renovar la cuenta o reemplazarla para evitar que los clientes se queden sin servicio.</i>`;

    const reply_markup = {
      inline_keyboard: [
        [
          { text: '📋 Ver cuentas', url: `${options.appUrl || ''}/cuentas` },
        ],
      ],
    };

    await sendMessage(chatId, mensaje, { reply_markup });
    return true;
  } catch (error) {
    console.error(`❌ Error enviando notif cuenta Telegram:`, error);
    return false;
  }
}

export async function enviarNotificacionMora(cliente: Record<string, unknown>, options: NotificacionOptions = {}): Promise<boolean> {
  try {
    const chatId = await getChatIdPorUid(cliente.propietarioId as string);
    if (!chatId) return false;

    const nombre = (cliente.nombre || cliente.nombreCliente || '') as string;
    const telefono = (cliente.telefono || '') as string;
    const plataforma = (cliente.plataforma || '') as string;
    const correo = (cliente.correo || '') as string;
    const perfilAsignado = (cliente.perfilAsignado || '') as string;
    const pantallas = Number(cliente.pantallas) || 1;
    const esMayorista = Boolean(cliente.esMayorista);
    const saldoPendiente = Number(cliente.saldoPendiente) || 0;
    const fechaVencimiento = (cliente.fechaVencimiento || '') as string;

    const lines: string[] = [
      `<b>💰 Alerta de pago pendiente</b>\n`,
      `👤 <b>Cliente:</b> ${escapeHtml(nombre)}`,
    ];

    if (telefono) {
      lines.push(`📞 <b>Teléfono:</b> ${escapeHtml(telefono)}`);
    }

    lines.push(`📺 <b>Servicio:</b> ${escapeHtml(plataforma || '—')}`);

    if (correo) {
      lines.push(`📧 <b>Cuenta:</b> <code>${escapeHtml(correo)}</code>`);
    }

    if (esMayorista || pantallas > 1) {
      lines.push(`📦 <b>Lote:</b> ${pantallas} pantallas (Mayorista)`);
    } else if (perfilAsignado) {
      lines.push(`📌 <b>Perfil:</b> ${escapeHtml(perfilAsignado)}`);
    }

    if (fechaVencimiento) {
      lines.push(`📅 <b>Vence:</b> ${escapeHtml(fechaVencimiento)}`);
    }

    lines.push(`💵 <b>Saldo pendiente:</b> <b>$${saldoPendiente.toLocaleString('es-CO')}</b>`);
    lines.push(`\n<i>Contactá al cliente para gestionar el cobro. Una vez pagado, registralo desde la app.</i>`);

    const mensaje = lines.join('\n');

    const platConDetalles = formatearPlataformaConDetalles(
      plataforma,
      correo,
      perfilAsignado,
      pantallas,
      esMayorista
    );

    const waMensaje = `Hola ${nombre},\n\nTe recordamos que tienes un saldo pendiente de *$${saldoPendiente.toLocaleString('es-CO')}* correspondiente a tu servicio de *${platConDetalles}*.\n\n¿Deseas realizar el pago para mantener tu cuenta activa y sin cortes?\n\nQuedamos atentos. Saludos.`;

    const waTexto = encodeURIComponent(waMensaje);

    const reply_markup = {
      inline_keyboard: [
        [
          { text: '📱 Contactar', url: `https://wa.me/${formatWaNumber((cliente.telefono as string) || '')}?text=${waTexto}` },
        ],
        [
          { text: '💰 Cobrado', url: `${options.appUrl || ''}/gestion-clientes` },
        ],
      ],
    };

    await sendMessage(chatId, mensaje, { reply_markup });
    return true;
  } catch (error) {
    console.error(`❌ Error enviando notif mora Telegram:`, error);
    return false;
  }
}