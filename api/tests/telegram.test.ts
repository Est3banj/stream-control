/**
 * telegramWebhook (ruta RAW): 405 no-POST, 403 secret inválido/faltante,
 * 200 OK siempre después de procesar (incluso si falla el procesamiento).
 */

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFirebaseModule } from './helpers/setupFirebase.js';
import { mockFirebaseAdmin } from './helpers/firebaseAdminMock.js';
import { createApp } from '../src/app.js';

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