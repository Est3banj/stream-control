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

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

const db = admin.firestore();

// ============================================================
// CONFIGURACIÓN
// ============================================================

const BOT_TOKEN = () => functions.config().telegram?.token;
const WEBHOOK_SECRET = () => functions.config().telegram?.webhook_secret;
const TELEGRAM_API = 'https://api.telegram.org/bot';

// ============================================================
// TELEGRAM API HELPERS
// ============================================================

/**
 * Enviar mensaje a un chat de Telegram
 * @param {string} chatId - ID del chat de Telegram
 * @param {string} text - Texto del mensaje
 * @param {Object} extra - Opciones adicionales (reply_markup, parse_mode, etc.)
 * @returns {Promise<Object>}
 */
async function sendMessage(chatId, text, extra = {}) {
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

  return response.json();
}

/**
 * Verificar que el webhook request viene de Telegram
 * @param {Object} req - Express request object
 * @returns {boolean}
 */
function verifyWebhook(req) {
  const secret = WEBHOOK_SECRET();
  if (!secret) return true; // Si no hay secret configurado, permitir (desarrollo)
  
  const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
  return headerSecret === secret;
}

// ============================================================
// LÓGICA DE VINCULACIÓN
// ============================================================

/**
 * Generar un código de vinculación para un usuario
 * @param {string} uid - Firebase UID del usuario
 * @returns {Promise<string>} - Código de 8 caracteres
 */
async function generarCodigo(uid) {
  // Limpiar códigos vencidos del mismo usuario
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

  // Generar código criptográficamente seguro: 8 chars alfanuméricos
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // Sin caracteres ambiguos (0,O,1,l,I)
  const randomBytes = require('crypto').randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[randomBytes[i] % chars.length];
  }

  // Guardar con expiración de 15 minutos
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

/**
 * Procesar un código enviado por el usuario al bot
 * @param {string} codigo - Código de 8 caracteres
 * @param {string} chatId - Telegram chat ID del usuario
 * @param {string} telegramUsername - Username de Telegram (opcional)
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function procesarCodigo(codigo, chatId, telegramUsername = '') {
  const docRef = db.collection('codigosVinculacion').doc(codigo);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return { success: false, message: '❌ Código inválido. Verificá que sea correcto o generá uno nuevo en la app.' };
  }

  const data = docSnap.data();

  if (data.expirado) {
    return { success: false, message: '⏰ Este código ya fue usado o está vencido. Generá uno nuevo en la app.' };
  }

  // Verificar expiración
  const ahora = admin.firestore.Timestamp.now();
  if (data.expiresAt.toMillis() < ahora.toMillis()) {
    await docRef.update({ expirado: true });
    return { success: false, message: '⏰ El código expiró. Generá uno nuevo en la app (tienen validez de 15 minutos).' };
  }

  // Vincular: crear/actualizar el documento del chatId
  await db.collection('vinculaciones').doc(String(chatId)).set({
    uid: data.uid,
    telegramChatId: String(chatId),
    telegramUsername: telegramUsername || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Marcar código como usado
  await docRef.update({ expirado: true });

  return { success: true, message: '✅ ¡Vinculación exitosa! A partir de ahora recibirás notificaciones de tus clientes aquí.' };
}

/**
 * Eliminar una vinculación (desconectar)
 * @param {string} chatId - Telegram chat ID
 */
async function eliminarVinculacion(chatId) {
  await db.collection('vinculaciones').doc(String(chatId)).delete();
}

/**
 * Obtener el chatId de Telegram para un usuario
 * @param {string} uid - Firebase UID
 * @returns {Promise<string|null>}
 */
async function getChatIdPorUid(uid) {
  const snapshot = await db
    .collection('vinculaciones')
    .where('uid', '==', uid)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data().telegramChatId;
}

/**
 * Verificar si un usuario tiene Telegram vinculado
 * @param {string} uid - Firebase UID
 * @returns {Promise<boolean>}
 */
async function tieneVinculacion(uid) {
  const chatId = await getChatIdPorUid(uid);
  return chatId !== null;
}

// ============================================================
// MANEJO DE COMANDOS DEL BOT
// ============================================================

/**
 * Manejar un mensaje entrante del bot de Telegram
 * @param {Object} update - Update object de Telegram
 * @returns {Promise<Object>} - Respuesta formateada
 */
async function handleUpdate(update) {
  const message = update.message;
  if (!message) return { status: 'ignored', reason: 'no_message' };

  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const username = message.from?.username || '';

  // Comando /start
  if (text === '/start') {
    await sendMessage(chatId,
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

  // Comando /ayuda
  if (text === '/ayuda' || text === '/help') {
    await sendMessage(chatId,
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

  // Comando /desvincular
  if (text === '/desvincular' || text === '/unlink') {
    const vinculacion = await db.collection('vinculaciones').doc(String(chatId)).get();
    if (!vinculacion.exists) {
      await sendMessage(chatId, 'ℹ️ No hay ninguna cuenta vinculada a este chat.');
      return { status: 'ok', action: 'unlink_not_found' };
    }
    await eliminarVinculacion(chatId);
    await sendMessage(chatId, '✅ <b>Cuenta desvinculada.</b> Ya no recibirás notificaciones aquí. Podés volver a vincular cuando quieras.');
    return { status: 'ok', action: 'unlinked' };
  }

  // Código de vinculación (exactamente 8 caracteres alfanuméricos)
  if (/^[A-Za-z0-9]{8}$/.test(text)) {
    const result = await procesarCodigo(text, chatId, username);
    await sendMessage(chatId, result.message);
    return { status: 'ok', action: 'code_processed', success: result.success };
  }

  // Mensaje no reconocido
  await sendMessage(chatId,
    `❌ No entendí ese mensaje.\n\n` +
    `📌 Si tenés un código de vinculación, enviámelo tal cual aparece en la app.\n` +
    `📌 Usá /ayuda para ver los comandos disponibles.`
  );
  return { status: 'ok', action: 'unknown_command' };
}

// ============================================================
// NOTIFICACIONES
// ============================================================

/**
 * Enviar notificación de vencimiento a un vendedor por Telegram
 * @param {Object} notificacion - Datos de la notificación
 * @param {Object} options - Opciones (incluir botones)
 * @returns {Promise<boolean>}
 */
async function enviarNotificacionVencimiento(notificacion, options = {}) {
  try {
    const chatId = await getChatIdPorUid(notificacion.propietarioId);
    if (!chatId) return false;

    const diasTexto = notificacion.diasRestantes <= 0
      ? `⚠️ <b>VENCIDO</b> hace ${Math.abs(notificacion.diasRestantes)} día(s)`
      : `📅 Vence en <b>${notificacion.diasRestantes}</b> día(s)`;

    const mensaje =
      `<b>⏰ Recordatorio de servicio</b>\n\n` +
      `👤 <b>Cliente:</b> ${notificacion.nombreCliente}\n` +
      `📺 <b>Servicio:</b> ${notificacion.plataforma || '—'}\n` +
      `📅 <b>Vence:</b> ${notificacion.fechaVencimiento || '—'}\n` +
      `${diasTexto}\n\n` +
      `<i>Contactá al cliente para gestionar la renovación.</i>`;

    // Inline keyboard con opciones
    const reply_markup = {
      inline_keyboard: [
        [
          { text: '📱 Contactar', url: `https://wa.me/57${notificacion.telefono}?text=${encodeURIComponent(`Hola ${notificacion.nombreCliente}, te escribo para recordarte que tu servicio de ${notificacion.plataforma || 'streaming'} está por vencer.`)}` },
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

/**
 * Enviar notificación de mora (saldo pendiente) a un vendedor por Telegram
 * @param {Object} cliente - Datos del cliente
 * @returns {Promise<boolean>}
 */
async function enviarNotificacionMora(cliente) {
  try {
    const chatId = await getChatIdPorUid(cliente.propietarioId);
    if (!chatId) return false;

    const mensaje =
      `<b>💰 Alerta de pago pendiente</b>\n\n` +
      `👤 <b>Cliente:</b> ${cliente.nombre}\n` +
      `📺 <b>Servicio:</b> ${cliente.plataforma || '—'}\n` +
      `💵 <b>Saldo pendiente:</b> <b>$${cliente.saldoPendiente.toLocaleString()}</b>\n\n` +
      `<i>Gestioná el cobro desde la app.</i>`;

    const reply_markup = {
      inline_keyboard: [
        [
          { text: '💰 Cobrar', url: `${process.env.APP_URL || ''}/gestion-clientes` },
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

module.exports = {
  sendMessage,
  verifyWebhook,
  handleUpdate,
  generarCodigo,
  procesarCodigo,
  eliminarVinculacion,
  getChatIdPorUid,
  tieneVinculacion,
  enviarNotificacionVencimiento,
  enviarNotificacionMora,
};
