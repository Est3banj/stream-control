/**
 * Telegram Bot helper para StreamControl Pro
 * 
 * Módulo separado para manejar la lógica del bot de Telegram:
 * - Vincular vendedores (código → chatId)
 * - Enviar notificaciones
 * - Manejar comandos
 * 
 * SEGURIDAD:
 * - Token almacenado en Firebase Config (functions:config), nunca en el código
 * - Webhook verifica secret_token de Telegram
 * - Códigos de vinculación: 8 chars crypto-random, expiran en 15 min
 * - Rate limiting básico contra brute force
 */

import { defineSecret, defineString } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import type * as functions from 'firebase-functions/v1';

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

interface NotificacionPayload {
  clienteId: string;
  nombreCliente: string;
  plataforma: string;
  diasRestantes: number;
  fechaVencimiento?: string;
  propietarioId: string;
  telefono?: string;
}

interface NotificacionOptions {
  appUrl?: string;
}

interface SuscripcionNotificacionPayload {
  usuarioNombre: string;
  planNombre: string;
  fechaFin: admin.firestore.Timestamp;
  diasRestantes: number;
  estado: string;
}

// Inicializar Firebase Admin si no está inicializado
// Necesario acá porque los imports se resuelven antes que el código de index.ts
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ============================================================
// CONFIGURACIÓN
// ============================================================

// ============================================================
// PARAMS & SECRETS (reemplaza functions.config())
// ============================================================

export const TELEGRAM_TOKEN = defineSecret('TELEGRAM_TOKEN');
export const TELEGRAM_WEBHOOK_SECRET = defineSecret('TELEGRAM_WEBHOOK_SECRET');
export const APP_URL = defineString('APP_URL');

const BOT_TOKEN = () => TELEGRAM_TOKEN.value();
const WEBHOOK_SECRET = () => TELEGRAM_WEBHOOK_SECRET.value();
const TELEGRAM_API = 'https://api.telegram.org/bot';

// ============================================================
// TELEGRAM API HELPERS
// ============================================================

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

export function verifyWebhook(req: functions.https.Request): boolean {
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

export async function enviarNotificacionVencimiento(notificacion: NotificacionPayload, options: NotificacionOptions = {}): Promise<boolean> {
  try {
    const chatId = await getChatIdPorUid(notificacion.propietarioId);
    if (!chatId) return false;

    const estadoVencido = notificacion.diasRestantes <= 0;
    const diasTexto = estadoVencido
      ? `⚠️ <b>VENCIDO</b> hace ${Math.abs(notificacion.diasRestantes)} día(s)`
      : `📅 Vence en <b>${notificacion.diasRestantes}</b> día(s)`;

    const mensaje =
      `<b>⏰ Recordatorio de servicio</b>\n\n` +
      `👤 <b>Cliente:</b> ${notificacion.nombreCliente}\n` +
      `📺 <b>Servicio:</b> ${notificacion.plataforma || '—'}\n` +
      `📅 <b>Vence:</b> ${notificacion.fechaVencimiento || '—'}\n` +
      `${diasTexto}\n\n` +
      `<i>Contactá al cliente para consultar si desea renovar. Si no renueva, marcalo como inactivo desde la app.</i>`;

    const saludo = `Hola ${notificacion.nombreCliente}, me comunico de StreamControl.`;
    const motivo = estadoVencido
      ? `Le recuerdo que su servicio de ${notificacion.plataforma || 'streaming'} se encuentra VENCIDO desde el ${notificacion.fechaVencimiento}.`
      : `Le recuerdo que su servicio de ${notificacion.plataforma || 'streaming'} está próximo a vencer el ${notificacion.fechaVencimiento}.`;
    const cierre = `Quedo atento a su confirmación. Si no desea renovar, puede ignorar este mensaje sin problema. Saludos.`;

    const waTexto = encodeURIComponent(`${saludo}\n\n${motivo}\n\n¿Desea renovarlo?\n\n${cierre}`);

    const reply_markup = {
      inline_keyboard: [
        [
          { text: '📱 Contactar', url: `https://wa.me/${notificacion.telefono?.replace(/[^0-9]/g, '') || ''}?text=${waTexto}` },
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

export async function enviarNotificacionMora(cliente: Record<string, unknown>, options: NotificacionOptions = {}): Promise<boolean> {
  try {
    const chatId = await getChatIdPorUid(cliente.propietarioId as string);
    if (!chatId) return false;

    const mensaje =
      `<b>💰 Alerta de pago pendiente</b>\n\n` +
      `👤 <b>Cliente:</b> ${cliente.nombre as string}\n` +
      `📺 <b>Servicio:</b> ${(cliente.plataforma as string) || '—'}\n` +
      `💵 <b>Saldo pendiente:</b> <b>$${Number(cliente.saldoPendiente).toLocaleString('es-CO')}</b>\n\n` +
      `<i>Contactá al cliente para gestionar el cobro. Una vez pagado, registralo desde la app.</i>`;

    const waTexto = encodeURIComponent(
      `Hola ${cliente.nombre as string}, me comunico de StreamControl para recordarle que tiene un saldo pendiente de $${Number(cliente.saldoPendiente).toLocaleString('es-CO')} por el servicio de ${(cliente.plataforma as string) || 'streaming'}.\n\n` +
      `Le agradecería realizar el pago para evitar la suspensión del servicio. Si ya realizó el pago, por favor ignore este mensaje.\n\n` +
      `Quedo atento. Saludos.`
    );

    const reply_markup = {
      inline_keyboard: [
        [
          { text: '📱 Contactar', url: `https://wa.me/${(cliente.telefono as string)?.replace(/[^0-9]/g, '') || ''}?text=${waTexto}` },
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
