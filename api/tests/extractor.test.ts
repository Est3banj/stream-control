/**
 * Suite de tests unitarios exhaustiva para el extractor de Netflix y otros servicios.
 *
 * Cubre:
 * - Decodificación de entidades HTML (&amp;, &quot;, &#39;, entidades numéricas dec/hex).
 * - Detección y filtrado de URLs de acción (isActionUrl) y ruido (isNoiseUrl, ManageAccountAccess, LKIDs).
 * - Normalización de texto y soporte para tags HTML anidados (<span>, <strong>, etc.).
 * - Botones en variantes multilingües (español, inglés, portugués) con ACTION_BUTTON_TEXT_REGEX.
 * - Fixtures reales de correos de Netflix:
 *   1. Email de viaje con botón "OBTENER CÓDIGO", tags anidados y query params con &amp;.
 *   2. Email de actualizar hogar con botón "Sí, la envié yo" / "Sí, fui yo" / "Actualizar Hogar" y footer de seguridad con ManageAccountAccess.
 *   3. Email de viaje con botón "Obtener código" y footer de seguridad con ManageAccountAccess.
 *   4. Fallback de inspección genérica que descarta ManageAccountAccess y prioriza URLs de acción legítimas.
 *   5. Extracción estricta de links para hogarnet y viajenet descartando números aleatorios del cuerpo (direcciones, códigos postales, IDs, fechas).
 *   6. Extracción de PIN numérico para ininet.
 *   7. Descarte de URLs inválidas (logo, Centro de Ayuda, etc.).
 * - Verificación de SUBJECT_KEYWORDS para Netflix.
 */

import { describe, expect, it } from 'vitest';
import {
  decodeEntities,
  cleanTrailingPunctuation,
  normalizeAnchorText,
  isTrustedHost,
  isNoiseUrl,
  isPreferredActionUrl,
  isActionUrl,
  ACTION_BUTTON_TEXT_REGEX,
  extractActionUrlFromHtml,
  extractCode,
} from '../src/extractor.js';
import { SUBJECT_KEYWORDS } from '../src/imap.js';

// ── decodeEntities ───────────────────────────────────────────────────────

describe('decodeEntities', () => {
  it('decodifica &amp; a &', () => {
    expect(decodeEntities('https://x.com?a=1&amp;b=2')).toBe('https://x.com?a=1&b=2');
  });

  it('decodifica &oacute;, &aacute;, &eacute;, &iacute;, &uacute;, &ntilde;', () => {
    expect(decodeEntities('Obtener c&oacute;digo de confirmaci&oacute;n')).toBe('Obtener código de confirmación');
    expect(decodeEntities('&Aacute;rbol &eacute;xito &iacute;cono &uacute;til &ntilde;and&uacute;')).toBe('Árbol éxito ícono útil ñandú');
  });

  it('decodifica &quot;, &#39;, &apos;, &nbsp;', () => {
    expect(decodeEntities('&quot;Hola&#39; &apos;Mundo&apos;&nbsp;!')).toBe('"Hola\' \'Mundo\' !');
  });

  it('decodifica entidades numéricas decimales (&#38;) y hexadecimales (&#x26;)', () => {
    expect(decodeEntities('https://netflix.com?token=123&#38;action=travel')).toBe('https://netflix.com?token=123&action=travel');
    expect(decodeEntities('https://netflix.com?token=123&#x26;action=travel')).toBe('https://netflix.com?token=123&action=travel');
    expect(decodeEntities('C&#243;digo')).toBe('Código');
  });

  it('deja intacto texto sin entidades', () => {
    expect(decodeEntities('https://netflix.com/verify?x=1')).toBe('https://netflix.com/verify?x=1');
  });
});

// ── cleanTrailingPunctuation ─────────────────────────────────────────────

describe('cleanTrailingPunctuation', () => {
  it('limpia punto final', () => {
    expect(cleanTrailingPunctuation('https://netflix.com/verify.')).toBe('https://netflix.com/verify');
  });

  it('limpia paréntesis + punto', () => {
    expect(cleanTrailingPunctuation('https://netflix.com/verify).')).toBe('https://netflix.com/verify');
  });

  it('limpia coma y dos puntos', () => {
    expect(cleanTrailingPunctuation('https://netflix.com/verify,')).toBe('https://netflix.com/verify');
    expect(cleanTrailingPunctuation('https://netflix.com/verify:')).toBe('https://netflix.com/verify');
  });

  it('re-balancea paréntesis sin cerrar al final', () => {
    expect(cleanTrailingPunctuation('https://netflix.com/verify(')).toBe('https://netflix.com/verify');
  });

  it('NO limpia query params válidos', () => {
    expect(cleanTrailingPunctuation('https://netflix.com/verify?token=abc-123&action=travel')).toBe('https://netflix.com/verify?token=abc-123&action=travel');
  });
});

// ── normalizeAnchorText ──────────────────────────────────────────────────

describe('normalizeAnchorText', () => {
  it('normaliza "Obtener código" en mayúsculas y minúsculas', () => {
    expect(normalizeAnchorText('Obtener código')).toBe('obtener codigo');
    expect(normalizeAnchorText('OBTENER CÓDIGO')).toBe('obtener codigo');
    expect(normalizeAnchorText('OBTENER TU CÓDIGO DE ACCESO')).toBe('obtener tu codigo de acceso');
  });

  it('elimina etiquetas HTML anidadas (<span>, <strong>, <b>, <font>, <div>)', () => {
    expect(normalizeAnchorText('<span><strong>OBTENER CÓDIGO</strong></span>')).toBe('obtener codigo');
    expect(normalizeAnchorText('<div class="btn"><font color="red"><span>Actualizar Hogar con Netflix</span></font></div>')).toBe('actualizar hogar con netflix');
    expect(normalizeAnchorText('<strong>Sí, fui yo</strong>')).toBe('si, fui yo');
    expect(normalizeAnchorText('<span><strong>Sí, la envié yo</strong></span>')).toBe('si, la envie yo');
  });

  it('normaliza variantes en inglés y portugués', () => {
    expect(normalizeAnchorText('Get Code')).toBe('get code');
    expect(normalizeAnchorText('Update Netflix Household')).toBe('update netflix household');
    expect(normalizeAnchorText('Sim, fui eu')).toBe('sim, fui eu');
    expect(normalizeAnchorText('Atualizar Residência Netflix')).toBe('atualizar residencia netflix');
  });

  it('decodifica entidades y colapsa whitespace múltiple', () => {
    expect(normalizeAnchorText('Obtener&nbsp;&nbsp;c&oacute;digo \n\t')).toBe('obtener codigo');
  });
});

// ── isTrustedHost ────────────────────────────────────────────────────────

describe('isTrustedHost', () => {
  it('acepta netflix.com y sus subdominios legítimos', () => {
    expect(isTrustedHost('https://netflix.com/account/travel/verify')).toBe(true);
    expect(isTrustedHost('https://www.netflix.com/account/travel/verify')).toBe(true);
    expect(isTrustedHost('https://account.netflix.com/verify?token=123')).toBe(true);
  });

  it('rechaza dominios maliciosos o de phishing con netflix en el subdominio', () => {
    expect(isTrustedHost('https://evil.netflix.com.fake.com/steal')).toBe(false);
    expect(isTrustedHost('https://netflix.com.attacker.org/verify')).toBe(false);
    expect(isTrustedHost('https://google.com')).toBe(false);
  });
});

// ── isNoiseUrl, isPreferredActionUrl e isActionUrl ───────────────────────

describe('isNoiseUrl, isPreferredActionUrl e isActionUrl', () => {
  it('detecta URLs de ruido clásicas (logo, help, browse, login, unsubscribe)', () => {
    expect(isNoiseUrl('https://www.netflix.com/')).toBe(true);
    expect(isNoiseUrl('https://netflix.com')).toBe(true);
    expect(isNoiseUrl('https://help.netflix.com/es/node/12345')).toBe(true);
    expect(isNoiseUrl('https://devices.netflix.com/es/')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/login')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/browse')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/privacy')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/email/unsubscribe')).toBe(true);
  });

  it('detecta ManageAccountAccess como ruido INCLUSO si contiene nftoken', () => {
    const manageUrl = 'https://www.netflix.com/ManageAccountAccess?g=4aa0cc1e-db6a-4d16-adc1-d4006a4a090e&lkid=URL_MANAGE_ACCOUNT_ACCESS&lnktrk=EVO&nftoken=AQAAAYw...';
    expect(isNoiseUrl(manageUrl)).toBe(true);
    expect(isActionUrl(manageUrl)).toBe(false);
    expect(isPreferredActionUrl(manageUrl)).toBe(false);
  });

  it('detecta /password y /youraccount como ruido incluso con tokens', () => {
    expect(isNoiseUrl('https://www.netflix.com/password?nftoken=123')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/youraccount?nftoken=123')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/youraccount/payment?nftoken=123')).toBe(true);
  });

  it('detecta URLs con LKID de ruido como ruido', () => {
    expect(isNoiseUrl('https://www.netflix.com/somepath?lkid=URL_MANAGE_ACCOUNT_ACCESS')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/somepath?lkid=URL_HELP')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/somepath?lkid=URL_TERMS')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/somepath?lkid=URL_PRIVACY')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/somepath?lkid=URL_SECURITY')).toBe(true);
  });

  it('reconoce URLs de acción de Netflix (isActionUrl e isPreferredActionUrl)', () => {
    expect(isActionUrl('https://www.netflix.com/account/travel/verify?token=abc')).toBe(true);
    expect(isActionUrl('https://account.netflix.com/account/update-primary-location?nftoken=xyz')).toBe(true);
    expect(isActionUrl('https://www.netflix.com/account/set-primary-location?token=xyz')).toBe(true);
    expect(isActionUrl('https://www.netflix.com/household/update?token=xyz')).toBe(true);
    expect(isActionUrl('https://www.netflix.com/youraccounttravel?nftoken=xyz')).toBe(true);
    expect(isActionUrl('https://www.netflix.com/verify?token=xyz')).toBe(true);
    expect(isActionUrl('https://www.netflix.com/email/click?token=xyz&redirect=1')).toBe(true);
    expect(isActionUrl('https://account.netflix.com/update-primary-location?token=123')).toBe(true);

    // Preferred action URLs
    expect(isPreferredActionUrl('https://account.netflix.com/account/update-primary-location?token=123')).toBe(true);
    expect(isPreferredActionUrl('https://account.netflix.com/account/travel/verify?token=123')).toBe(true);
    expect(isPreferredActionUrl('https://www.netflix.com/something?lkid=URL_UPDATE_PRIMARY_LOCATION')).toBe(true);
  });

  it('isActionUrl descarta URLs no confiables o ruido', () => {
    expect(isActionUrl('https://www.netflix.com/')).toBe(false);
    expect(isActionUrl('https://help.netflix.com/es/node/123')).toBe(false);
    expect(isActionUrl('https://evil.com/account/travel/verify?token=abc')).toBe(false);
  });
});

// ── ACTION_BUTTON_TEXT_REGEX ─────────────────────────────────────────────

describe('ACTION_BUTTON_TEXT_REGEX', () => {
  it('matchea variantes de "Sí, la envié yo", "Sí, lo envié yo", "Sí, fui yo"', () => {
    expect(ACTION_BUTTON_TEXT_REGEX.test('Sí, la envié yo')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Si, la envie yo')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Sí, lo envié yo')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Si, lo envie yo')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Sí, fui yo')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Si, fui yo')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('si, la envie yo')).toBe(true);
  });

  it('matchea variantes de "Actualizar Hogar"', () => {
    expect(ACTION_BUTTON_TEXT_REGEX.test('Actualizar Hogar')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Actualizar Hogar con Netflix')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Actualiza tu hogar')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Actualizar tu hogar')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Confirmar hogar')).toBe(true);
  });

  it('matchea variantes de "Obtener código"', () => {
    expect(ACTION_BUTTON_TEXT_REGEX.test('Obtener código')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('OBTENER CÓDIGO')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Obtener tu código')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Obtener código de acceso')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Tu código de acceso temporal')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('obtener codigo')).toBe(true);
  });

  it('matchea variantes en inglés', () => {
    expect(ACTION_BUTTON_TEXT_REGEX.test('Yes, I sent this')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Yes, this was me')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Update Netflix Household')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Get code')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Get access code')).toBe(true);
  });

  it('matchea variantes en portugués', () => {
    expect(ACTION_BUTTON_TEXT_REGEX.test('Sim, fui eu')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Sim, enviei eu')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Sim, foi eu')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Atualizar Residência Netflix')).toBe(true);
    expect(ACTION_BUTTON_TEXT_REGEX.test('Obter código')).toBe(true);
  });
});

// ── Fixtures de emails de Netflix ────────────────────────────────────────

describe('extractCode — Fixtures reales de Netflix', () => {
  it('Caso Real Producción: Email "Actualizar Hogar" con botón "Sí, la envié yo" y footer con ManageAccountAccess', () => {
    const HTML_PROD_ACTUALIZAR_HOGAR = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body>
        <table width="100%">
          <tr>
            <td>
              <a href="https://www.netflix.com/"><img src="https://assets.netflix.com/logo.png" alt="Netflix"></a>
            </td>
          </tr>
          <tr>
            <td>
              <h2>Cómo actualizar tu Hogar con Netflix</h2>
              <p>Un dispositivo en tu red solicitó actualizar tu Hogar con Netflix.</p>
              <table class="button-table">
                <tr>
                  <td>
                    <a href="https://account.netflix.com/account/update-primary-location?token=VALID_PRIMARY_TOKEN_123&amp;nftok=1&amp;lkid=URL_UPDATE_PRIMARY_LOCATION" target="_blank" style="background:#E50914;color:#fff;">
                      <span><strong>Sí, la envié yo</strong></span>
                    </a>
                  </td>
                </tr>
              </table>
              <p>Si no fuiste tú, te recomendamos cambiar tu contraseña inmediatamente.</p>
            </td>
          </tr>
          <tr>
            <td>
              <div class="footer">
                <p>Protege tu cuenta: Si no sabes quién envió la solicitud, te recomendamos cerrar sesión de inmediato en todos los dispositivos que no reconozcas visitando <a href="https://www.netflix.com/ManageAccountAccess?g=4aa0cc1e-db6a-4d16-adc1-d4006a4a090e&amp;lkid=URL_MANAGE_ACCOUNT_ACCESS&amp;lnktrk=EVO&amp;nftoken=FOOTER_SECURITY_TOKEN_999">Administrar acceso y dispositivos</a>.</p>
                <a href="https://help.netflix.com/node/123?lkid=URL_HELP">Centro de ayuda</a> |
                <a href="https://www.netflix.com/privacy?lkid=URL_PRIVACY">Privacidad</a>
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const result = extractCode('', 'hogarnet', HTML_PROD_ACTUALIZAR_HOGAR);
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
    expect(result!.expiraEn).toBe(15);
    expect(result!.codigo).toBe('https://account.netflix.com/account/update-primary-location?token=VALID_PRIMARY_TOKEN_123&nftok=1&lkid=URL_UPDATE_PRIMARY_LOCATION');
    expect(result!.codigo).not.toContain('ManageAccountAccess');
    expect(result!.codigo).not.toContain('&amp;');

    const htmlAction = extractActionUrlFromHtml(HTML_PROD_ACTUALIZAR_HOGAR, 'hogarnet');
    expect(htmlAction).not.toBeNull();
    expect(htmlAction!.codigo).toBe('https://account.netflix.com/account/update-primary-location?token=VALID_PRIMARY_TOKEN_123&nftok=1&lkid=URL_UPDATE_PRIMARY_LOCATION');
  });

  it('Caso Real Producción: Email "Estoy de viaje" con botón "Obtener código" y footer con ManageAccountAccess', () => {
    const HTML_PROD_VIAJE = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body>
        <table width="100%">
          <tr>
            <td>
              <a href="https://www.netflix.com/"><img src="https://assets.netflix.com/logo.png" alt="Netflix"></a>
            </td>
          </tr>
          <tr>
            <td>
              <h1>Solicitud de código de acceso temporal</h1>
              <p>Hola, recibimos una solicitud para acceder a tu cuenta de Netflix en un nuevo dispositivo.</p>
              <table class="button-table">
                <tr>
                  <td>
                    <a href="https://account.netflix.com/account/travel/verify?nftoken=AQAAAYw_TRAVEL_TOKEN...&amp;action=travel&amp;locale=es-US&amp;lkid=URL_TRAVEL_VERIFY" target="_blank" style="background:#E50914;color:#fff;">
                      <span><strong>OBTENER CÓDIGO</strong></span>
                    </a>
                  </td>
                </tr>
              </table>
              <p>El código vence en 15 minutos.</p>
            </td>
          </tr>
          <tr>
            <td>
              <p>Protege tu cuenta: Si no sabes quién envió la solicitud, te recomendamos cerrar sesión de inmediato en todos los dispositivos que no reconozcas</p>
              <a href="https://www.netflix.com/ManageAccountAccess?g=4aa0cc1e-db6a-4d16-adc1-d4006a4a090e&amp;lkid=URL_MANAGE_ACCOUNT_ACCESS&amp;lnktrk=EVO&amp;nftoken=FOOTER_TOKEN_999">Administrar dispositivos</a> |
              <a href="https://help.netflix.com/es/node/12345?lkid=URL_HELP">Centro de ayuda</a>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const result = extractCode('', 'viajenet', HTML_PROD_VIAJE);
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
    expect(result!.expiraEn).toBe(15);
    expect(result!.codigo).toBe('https://account.netflix.com/account/travel/verify?nftoken=AQAAAYw_TRAVEL_TOKEN...&action=travel&locale=es-US&lkid=URL_TRAVEL_VERIFY');
    expect(result!.codigo).not.toContain('ManageAccountAccess');
    expect(result!.codigo).not.toContain('&amp;');
  });

  it('Caso Fallback genérico: Sin match de texto de botón, filtra ManageAccountAccess y prefiere URL de acción', () => {
    const HTML_GENERICO = `
      <html>
      <body>
        <a href="https://www.netflix.com/"><img src="logo.png"></a>
        <p>Para confirmar tu ubicación, haz clic en el siguiente enlace:</p>
        <a href="https://account.netflix.com/account/update-primary-location?token=SECURE_PRIMARY_TOKEN&amp;lkid=URL_UPDATE_PRIMARY_LOCATION">Hacé clic aquí</a>
        <div class="footer">
          <a href="https://www.netflix.com/ManageAccountAccess?g=4aa0cc1e&amp;lkid=URL_MANAGE_ACCOUNT_ACCESS&amp;nftoken=FOOTER_TOKEN">Cerrar sesión en dispositivos</a>
          <a href="https://help.netflix.com/node/123">Ayuda</a>
        </div>
      </body>
      </html>
    `;

    const result = extractCode('', 'hogarnet', HTML_GENERICO);
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
    expect(result!.codigo).toBe('https://account.netflix.com/account/update-primary-location?token=SECURE_PRIMARY_TOKEN&lkid=URL_UPDATE_PRIMARY_LOCATION');
    expect(result!.codigo).not.toContain('ManageAccountAccess');
  });

  it('Caso: Email de actualizar hogar con botón "Sí, fui yo" / "Actualizar Hogar con Netflix" sin PIN', () => {
    const HTML_ACTUALIZAR_HOGAR = `
      <!DOCTYPE html>
      <html>
      <body>
        <a href="https://www.netflix.com/"><img src="logo.png"></a>
        <h2>Cómo actualizar tu Hogar con Netflix</h2>
        <p>Un dispositivo en tu red solicitó actualizar tu Hogar con Netflix.</p>
        <a href="https://account.netflix.com/account/update-primary-location?token=SECURE_TOKEN_999&amp;nftok=1" class="btn">
          <span><strong style="color: #ffffff;">Sí, fui yo</strong></span>
        </a>
        <p>Si no fuiste tú, te recomendamos cambiar tu contraseña inmediatamente.</p>
        <a href="https://help.netflix.com/">Ayuda</a>
      </body>
      </html>
    `;

    const result = extractCode('', 'hogarnet', HTML_ACTUALIZAR_HOGAR);
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
    expect(result!.expiraEn).toBe(15);
    expect(result!.codigo).toBe('https://account.netflix.com/account/update-primary-location?token=SECURE_TOKEN_999&nftok=1');
  });

  it('Caso: Email de actualizar hogar con botón en portugués "Atualizar Residência Netflix"', () => {
    const HTML_RESIDENCIA_PT = `
      <html>
      <body>
        <a href="https://www.netflix.com/"><img src="logo.png"></a>
        <p>Atualize sua Residência Netflix para continuar assistindo.</p>
        <a href="https://www.netflix.com/household/update?token=PT_TOKEN_777">
          <div class="button"><span>Atualizar Residência Netflix</span></div>
        </a>
      </body>
      </html>
    `;

    const result = extractCode('', 'hogarnet', HTML_RESIDENCIA_PT);
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
    expect(result!.codigo).toBe('https://www.netflix.com/household/update?token=PT_TOKEN_777');
  });

  it('Caso: Email de actualizar hogar (hogarnet) con dirección, código postal (CA 95032) e ID de solicitud (24853) extrae estrictamente URL del botón', () => {
    const TEXT_BODY = `
      Netflix
      Cómo actualizar tu Hogar con Netflix
      Un dispositivo en tu red solicitó actualizar tu Hogar con Netflix.
      Código de solicitud: 24853
      Ubicación: Los Gatos, CA 95032
      Fecha: 22 de septiembre de 2026 a las 15:30:00
      Dispositivo: Samsung Smart TV (ID 839104)

      Si enviaste esta solicitud, confirma tu hogar haciendo clic en el enlace.
    `;
    const HTML_BODY = `
      <html><body>
        <a href="https://www.netflix.com/"><img src="logo.png"></a>
        <p>Un dispositivo en tu red solicitó actualizar tu Hogar con Netflix.</p>
        <p>Ubicación: Los Gatos, CA 95032. Código: 24853</p>
        <a href="https://account.netflix.com/account/update-primary-location?token=VALID_PRIMARY_TOKEN_456&amp;lkid=URL_UPDATE_PRIMARY_LOCATION">
          <span><strong>Sí, la envié yo</strong></span>
        </a>
        <p>Si no fuiste tú, visita <a href="https://www.netflix.com/ManageAccountAccess?nftoken=noise">Administrar dispositivos</a>.</p>
      </body></html>
    `;

    const result = extractCode(TEXT_BODY, 'hogarnet', HTML_BODY);
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
    expect(result!.codigo).toBe('https://account.netflix.com/account/update-primary-location?token=VALID_PRIMARY_TOKEN_456&lkid=URL_UPDATE_PRIMARY_LOCATION');
    expect(result!.expiraEn).toBe(15);
    expect(result!.codigo).not.toContain('24853');
    expect(result!.codigo).not.toContain('95032');
  });

  it('Caso: Email de viaje (viajenet) con números en texto plano / HTML extrae estrictamente URL del botón', () => {
    const TEXT_BODY = `
      Netflix
      Solicitud de código de acceso temporal.
      Recibimos una solicitud desde Los Gatos, CA 95032 (Código ref: 83921).
      Válido por 15 minutos (17:08 hs).
    `;
    const HTML_BODY = `
      <html><body>
        <p>Código ref: 83921 en CA 95032.</p>
        <a href="https://account.netflix.com/account/travel/verify?nftoken=TRAVEL_TOKEN_888&amp;lkid=URL_TRAVEL_VERIFY">
          <span><strong>Obtener código</strong></span>
        </a>
      </body></html>
    `;

    const result = extractCode(TEXT_BODY, 'viajenet', HTML_BODY);
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
    expect(result!.codigo).toBe('https://account.netflix.com/account/travel/verify?nftoken=TRAVEL_TOKEN_888&lkid=URL_TRAVEL_VERIFY');
    expect(result!.expiraEn).toBe(15);
    expect(result!.codigo).not.toContain('83921');
    expect(result!.codigo).not.toContain('95032');
  });

  it('Caso: Email de hogarnet en texto plano con URL de acción y números en el cuerpo', () => {
    const TEXT_BODY = `
      Netflix
      Actualizar tu Hogar con Netflix
      Código: 99482. Ubicación: CA 95032.
      Para confirmar tu hogar, visita el enlace:
      https://account.netflix.com/account/update-primary-location?token=TEXT_ONLY_TOKEN_777&lkid=URL_UPDATE_PRIMARY_LOCATION
    `;

    const result = extractCode(TEXT_BODY, 'hogarnet');
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
    expect(result!.codigo).toBe('https://account.netflix.com/account/update-primary-location?token=TEXT_ONLY_TOKEN_777&lkid=URL_UPDATE_PRIMARY_LOCATION');
    expect(result!.expiraEn).toBe(15);
  });

  it('Caso: Descarte de URLs inválidas (logo, ayuda, browse) cuando no hay botón de acción ni PIN', () => {
    const HTML_SOLO_NOISE = `
      <html>
      <body>
        <a href="https://www.netflix.com/"><img src="logo.png" alt="Netflix"></a>
        <p>Gracias por ser miembro de Netflix. Consulta las novedades en tu catálogo.</p>
        <a href="https://www.netflix.com/browse">Ir a explorar títulos</a>
        <a href="https://help.netflix.com/es/node/412">Centro de ayuda</a>
        <a href="https://www.netflix.com/privacy">Aviso de privacidad</a>
        <a href="https://www.netflix.com/ManageAccountAccess?g=123&amp;lkid=URL_MANAGE_ACCOUNT_ACCESS&amp;nftoken=xyz">Administrar dispositivos</a>
      </body>
      </html>
    `;

    const result = extractCode('', 'hogarnet', HTML_SOLO_NOISE);
    expect(result).toBeNull();

    const resultViaje = extractCode('', 'viajenet', HTML_SOLO_NOISE);
    expect(resultViaje).toBeNull();
  });

  it('Caso: Email de inicio de sesión de Netflix (ininet) con código numérico multilínea', () => {
    const TEXT_ININET = `
      Netflix

      Ingresa este código para iniciar sesión en tu dispositivo

      3948

      El código vence en 15 minutos.
    `;

    const result = extractCode(TEXT_ININET, 'ininet');
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('numerico');
    expect(result!.codigo).toBe('3948');
  });
});

// ── Verificación de SUBJECT_KEYWORDS ──────────────────────────────────────

describe('SUBJECT_KEYWORDS — Variaciones de Asunto', () => {
  it('Matchea todas las variaciones de asunto para viajenet', () => {
    const re = SUBJECT_KEYWORDS.viajenet;
    expect(re.test('Importante: Cómo obtener tu código de acceso temporal para Netflix')).toBe(true);
    expect(re.test('Tu código de acceso temporal de Netflix')).toBe(true);
    expect(re.test('Netflix: Solicitud de código de acceso temporal')).toBe(true);
    expect(re.test('¿Estás viajando? Tu código de acceso')).toBe(true);
    expect(re.test('Estás de viaje - Nuevo dispositivo')).toBe(true);
    expect(re.test('Temporary access code for Netflix')).toBe(true);
    expect(re.test('Your Netflix travel code')).toBe(true);
    expect(re.test('Seu código de acesso temporário da Netflix')).toBe(true);
    expect(re.test('Você está viajando?')).toBe(true);
  });

  it('Matchea todas las variaciones de asunto para hogarnet', () => {
    const re = SUBJECT_KEYWORDS.hogarnet;
    expect(re.test('Importante: Cómo actualizar tu Hogar con Netflix')).toBe(true);
    expect(re.test('Actualizar Hogar con Netflix')).toBe(true);
    expect(re.test('Confirma tu hogar con Netflix')).toBe(true);
    expect(re.test('Tu código para Hogar de Netflix')).toBe(true);
    expect(re.test('Tu TV forma parte de tu Hogar con Netflix')).toBe(true);
    expect(re.test('Important: Update your Netflix Household')).toBe(true);
    expect(re.test('Confirm your Netflix Household')).toBe(true);
    expect(re.test('Importante: Como atualizar sua Residência Netflix')).toBe(true);
    expect(re.test('Confirmar Residência Netflix')).toBe(true);
    expect(re.test('Set primary location for your account')).toBe(true);
  });

  it('Matchea variaciones de asunto para otros servicios', () => {
    expect(SUBJECT_KEYWORDS.ininet.test('Netflix: Tu código de inicio de sesión')).toBe(true);
    expect(SUBJECT_KEYWORDS.resetnet.test('Restablecer tu contraseña de Netflix')).toBe(true);
    expect(SUBJECT_KEYWORDS.wincode.test('Tu código de confirmación Win')).toBe(true);
    expect(SUBJECT_KEYWORDS.cgptcode.test('OpenAI verification code')).toBe(true);
    expect(SUBJECT_KEYWORDS.accmax.test('Tu código de acceso a Max')).toBe(true);
  });
});
