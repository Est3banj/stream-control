/**
 * telegramWebhook (ruta RAW): 405 no-POST, 403 secret inválido/faltante,
 * 200 OK siempre después de procesar (incluso si falla el procesamiento).
 */

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, mockFirebaseModule } from './helpers/setupFirebase.js';
import { mockFirebaseAdmin } from './helpers/firebaseAdminMock.js';
import { createApp } from '../src/app.js';
import { enviarNotificacionVencimiento, enviarNotificacionMora } from '../src/telegram.js';

vi.mock('../src/firebase', () => mockFirebaseModule());
vi.mock('firebase-admin', () => mockFirebaseAdmin());

const app = createApp();

describe('telegramWebhook (raw)', () => {
  const secret = 'webhook-secret-1337';

  beforeEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('métodos no-POST → 404 (express solo enruta POST /api/:fn; nunca llega al handler)', async () => {
    // En functions v2 el onRequest respondía 405; en Express la ruta es post-only,
    // así que GET cae en el catch-all 404 envelope. Ambas rechazan la llamada.
    const res = await request(app).get('/api/telegramWebhook');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not-found');
  });

  it('403 Forbidden si TELEGRAM_WEBHOOK_SECRET está configurado y el header no coincide', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = secret;
    const res = await request(app)
      .post('/api/telegramWebhook')
      .set('x-telegram-bot-api-secret-token', 'wrong')
      .send({ update_id: 1 });
    expect(res.status).toBe(403);
    expect(res.text).toBe('Forbidden');
  });

  it('403 si falta el header y el secret está configurado', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = secret;
    const res = await request(app).post('/api/telegramWebhook').send({ update_id: 1 });
    expect(res.status).toBe(403);
  });

  it('200 OK y envía mensaje cuando el secret coincide', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = secret;
    process.env.TELEGRAM_TOKEN = '123:tok';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })));

    const res = await request(app)
      .post('/api/telegramWebhook')
      .set('x-telegram-bot-api-secret-token', secret)
      .send({ update_id: 1, message: { chat: { id: 4242 }, text: '/start', from: { id: 4242 } } });

    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
    expect(fetch).toHaveBeenCalled();
  });

  it('200 OK aun si falla el procesamiento interno (Telegram no reintenta con error)', async () => {
    // Sin TELEGRAM_TOKEN → sendMessage lanza TELEGRAM_TOKEN_NO_CONFIGURED
    const res = await request(app)
      .post('/api/telegramWebhook')
      .send({ update_id: 1, message: { chat: { id: 4242 }, text: '/start', from: { id: 4242 } } });

    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });

  it('sin TELEGRAM_WEBHOOK_SECRET configurado → permite cualquier POST', async () => {
    process.env.TELEGRAM_TOKEN = '123:tok';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })));

    const res = await request(app)
      .post('/api/telegramWebhook')
      .send({ update_id: 1, message: { chat: { id: 1 }, text: '/ayuda', from: { id: 1 } } });

    expect(res.status).toBe(200);
  });
});

describe('enviarNotificacionVencimiento & enviarNotificacionMora (enriched layout)', () => {
  beforeEach(() => {
    backend.reset();
    process.env.TELEGRAM_TOKEN = '123:tok';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('enviarNotificacionVencimiento includes email in <code>, profile, platform, date, balance, wa button', async () => {
    backend.seed('vinculaciones', 'v-1', { uid: 'uid-1', telegramChatId: '99999' });

    let sentBody: any = null;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, opts: any) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ ok: true }) };
    }));

    const result = await enviarNotificacionVencimiento(
      {
        clienteId: 'c-1',
        nombreCliente: 'Juan Pérez',
        plataforma: 'Netflix 4K',
        diasRestantes: 2,
        fechaVencimiento: '2026-09-05',
        propietarioId: 'uid-1',
        telefono: '+573001234567',
        correo: 'juan_cuenta@streaming.com',
        perfilAsignado: 'Perfil 3',
        pantallas: 1,
        saldoPendiente: 15000,
        esMayorista: false,
      },
      { appUrl: 'https://app.streamcontrol.com' }
    );

    expect(result).toBe(true);
    expect(sentBody).not.toBeNull();
    expect(sentBody.chat_id).toBe('99999');
    expect(sentBody.text).toContain('👤 <b>Cliente:</b> Juan Pérez');
    expect(sentBody.text).toContain('📞 <b>Teléfono:</b> +573001234567');
    expect(sentBody.text).toContain('📺 <b>Servicio:</b> Netflix 4K');
    expect(sentBody.text).toContain('📧 <b>Cuenta:</b> <code>juan_cuenta@streaming.com</code>');
    expect(sentBody.text).toContain('📌 <b>Perfil:</b> Perfil 3');
    expect(sentBody.text).toContain('📅 <b>Vence:</b> 2026-09-05');
    expect(sentBody.text).toContain('⏱️ Vence en <b>2</b> día(s)');
    expect(sentBody.text).toContain('💵 <b>Saldo pendiente:</b> <b>$15.000</b>');

    // Buttons
    const buttons = sentBody.reply_markup.inline_keyboard;
    expect(buttons[0][0].text).toBe('📱 Contactar');
    expect(buttons[0][0].url).toContain('https://wa.me/573001234567');
    const waDecoded = decodeURIComponent(buttons[0][0].url);
    expect(waDecoded).toContain('Hola Juan Pérez');
    expect(waDecoded).toContain('Netflix 4K (Cuenta: juan_cuenta@streaming.com - Perfil: Perfil 3)');
    expect(waDecoded).toContain('está próximo a vencer el *2026-09-05*');
    expect(waDecoded).toContain('¿Deseas renovarlo para seguir disfrutando sin interrupciones?');
    expect(buttons[1][0].text).toBe('👤 Ver cliente');
    expect(buttons[1][0].url).toBe('https://app.streamcontrol.com/gestion-clientes');
  });

  it('enviarNotificacionVencimiento renders wholesale lot and expired state', async () => {
    backend.seed('vinculaciones', 'v-2', { uid: 'uid-2', telegramChatId: '88888' });

    let sentBody: any = null;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, opts: any) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ ok: true }) };
    }));

    const result = await enviarNotificacionVencimiento(
      {
        clienteId: 'c-2',
        nombreCliente: 'Distribuidor Mayorista',
        plataforma: 'Disney+',
        diasRestantes: -1,
        fechaVencimiento: '2026-09-02',
        propietarioId: 'uid-2',
        telefono: '+573110001122',
        correo: 'disney_mayorista@streaming.com',
        pantallas: 5,
        esMayorista: true,
      },
      { appUrl: 'https://app.streamcontrol.com' }
    );

    expect(result).toBe(true);
    expect(sentBody.text).toContain('📦 <b>Lote:</b> 5 pantallas (Mayorista)');
    expect(sentBody.text).toContain('⚠️ <b>VENCIDO</b> hace 1 día(s)');
    expect(sentBody.text).not.toContain('💵 <b>Saldo pendiente:</b>');

    const waDecodedExpired = decodeURIComponent(sentBody.reply_markup.inline_keyboard[0][0].url);
    expect(waDecodedExpired).toContain('Hola Distribuidor Mayorista');
    expect(waDecodedExpired).toContain('Disney+ (Cuenta: disney_mayorista@streaming.com - 5 pantallas)');
    expect(waDecodedExpired).toContain('se encuentra VENCIDO desde el *2026-09-02*');
    expect(waDecodedExpired).toContain('¿Deseas reactivar tu cuenta para mantener tu perfil y servicio activo?');
  });

  it('enviarNotificacionMora renders debt alert with full client details', async () => {
    backend.seed('vinculaciones', 'v-3', { uid: 'uid-3', telegramChatId: '77777' });

    let sentBody: any = null;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, opts: any) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ ok: true }) };
    }));

    const result = await enviarNotificacionMora(
      {
        id: 'c-3',
        nombre: 'Carlos Mora',
        telefono: '+573209876543',
        plataforma: 'Max Standard',
        correo: 'carlos_max@cuenta.com',
        perfilAsignado: 'Perfil 1',
        saldoPendiente: 25000,
        fechaVencimiento: '2026-09-01',
        propietarioId: 'uid-3',
      },
      { appUrl: 'https://app.streamcontrol.com' }
    );

    expect(result).toBe(true);
    expect(sentBody.chat_id).toBe('77777');
    expect(sentBody.text).toContain('<b>💰 Alerta de pago pendiente</b>');
    expect(sentBody.text).toContain('👤 <b>Cliente:</b> Carlos Mora');
    expect(sentBody.text).toContain('📞 <b>Teléfono:</b> +573209876543');
    expect(sentBody.text).toContain('📺 <b>Servicio:</b> Max Standard');
    expect(sentBody.text).toContain('📧 <b>Cuenta:</b> <code>carlos_max@cuenta.com</code>');
    expect(sentBody.text).toContain('📌 <b>Perfil:</b> Perfil 1');
    expect(sentBody.text).toContain('📅 <b>Vence:</b> 2026-09-01');
    expect(sentBody.text).toContain('💵 <b>Saldo pendiente:</b> <b>$25.000</b>');

    const buttons = sentBody.reply_markup.inline_keyboard;
    expect(buttons[0][0].text).toBe('📱 Contactar');
    expect(buttons[0][0].url).toContain('https://wa.me/573209876543');
    const waDecodedMora = decodeURIComponent(buttons[0][0].url);
    expect(waDecodedMora).toContain('Hola Carlos Mora');
    expect(waDecodedMora).toContain('Max Standard (Cuenta: carlos_max@cuenta.com - Perfil: Perfil 1)');
    expect(waDecodedMora).toContain('saldo pendiente de *$25.000*');
    expect(waDecodedMora).toContain('¿Deseas realizar el pago para mantener tu cuenta activa y sin cortes?');
    expect(buttons[1][0].text).toBe('💰 Cobrado');
    expect(buttons[1][0].url).toBe('https://app.streamcontrol.com/gestion-clientes');
  });

  it('escapes special HTML characters in client name and fields', async () => {
    backend.seed('vinculaciones', 'v-4', { uid: 'uid-4', telegramChatId: '66666' });

    let sentBody: any = null;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, opts: any) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ ok: true }) };
    }));

    await enviarNotificacionVencimiento(
      {
        clienteId: 'c-4',
        nombreCliente: 'Pedro <Tester> & Co',
        plataforma: 'Prime <Video>',
        diasRestantes: 1,
        fechaVencimiento: '2026-09-04',
        propietarioId: 'uid-4',
        correo: 'pedro&co@test.com',
        perfilAsignado: 'Perfil <A>',
      }
    );

    expect(sentBody.text).toContain('Pedro &lt;Tester&gt; &amp; Co');
    expect(sentBody.text).toContain('Prime &lt;Video&gt;');
    expect(sentBody.text).toContain('<code>pedro&amp;co@test.com</code>');
    expect(sentBody.text).toContain('Perfil &lt;A&gt;');
  });
});