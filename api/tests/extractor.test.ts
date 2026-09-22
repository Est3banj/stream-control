/**
 * Suite de tests unitarios exhaustiva para el extractor de Netflix y otros servicios.
 *
 * Cubre:
 * - Decodificación de entidades HTML (&amp;, &quot;, &#39;, entidades numéricas dec/hex).
 * - Detección y filtrado de URLs de acción (isActionUrl) y ruido (isNoiseUrl).
 * - Normalización de texto y soporte para tags HTML anidados (<span>, <strong>, etc.).
 * - Botones en variantes multilingües (español, inglés, portugués) e insensibles a mayúsculas/minúsculas.
 * - Fixtures reales de correos de Netflix:
 *   1. Email de viaje con botón "OBTENER CÓDIGO", tags anidados y query params con &amp;.
 *   2. Email de actualizar hogar con botón "Sí, fui yo" / "Actualizar Hogar con Netflix" sin PIN.
 *   3. Email con PIN tradicional numérico.
 *   4. Descarte de URLs inválidas (logo, Centro de Ayuda, etc.).
 * - Verificación de SUBJECT_KEYWORDS para Netflix.
 */

import { describe, expect, it } from 'vitest';
import {
  decodeEntities,
  cleanTrailingPunctuation,
  normalizeAnchorText,
  isTrustedHost,
  isNoiseUrl,
  isActionUrl,
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

// ── isNoiseUrl y isActionUrl ─────────────────────────────────────────────

describe('isNoiseUrl e isActionUrl', () => {
  it('detecta URLs de ruido (logo, help, browse, login, unsubscribe)', () => {
    expect(isNoiseUrl('https://www.netflix.com/')).toBe(true);
    expect(isNoiseUrl('https://netflix.com')).toBe(true);
    expect(isNoiseUrl('https://help.netflix.com/es/node/12345')).toBe(true);
    expect(isNoiseUrl('https://devices.netflix.com/es/')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/login')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/browse')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/privacy')).toBe(true);
    expect(isNoiseUrl('https://www.netflix.com/email/unsubscribe')).toBe(true);
  });

  it('reconoce URLs de acción de Netflix (isActionUrl)', () => {
    expect(isActionUrl('https://www.netflix.com/account/travel/verify?token=abc')).toBe(true);
    expect(isActionUrl('https://account.netflix.com/account/update-primary-location?nftoken=xyz')).toBe(true);
    expect(isActionUrl('https://www.netflix.com/account/set-primary-location?token=xyz')).toBe(true);
    expect(isActionUrl('https://www.netflix.com/household/update?token=xyz')).toBe(true);
    expect(isActionUrl('https://www.netflix.com/youraccounttravel?nftoken=xyz')).toBe(true);
    expect(isActionUrl('https://www.netflix.com/verify?token=xyz')).toBe(true);
    expect(isActionUrl('https://www.netflix.com/email/click?token=xyz&redirect=1')).toBe(true);
    expect(isActionUrl('https://account.netflix.com/update-primary-location?token=123')).toBe(true);
  });

  it('isActionUrl descarta URLs no confiables o ruido', () => {
    expect(isActionUrl('https://www.netflix.com/')).toBe(false);
    expect(isActionUrl('https://help.netflix.com/es/node/123')).toBe(false);
    expect(isActionUrl('https://evil.com/account/travel/verify?token=abc')).toBe(false);
  });
});

// ── Fixtures de emails de Netflix ────────────────────────────────────────

describe('extractCode — Fixtures reales de Netflix', () => {
  it('Caso 1: Email de viaje con botón "OBTENER CÓDIGO", tags anidados y query params con &amp;', () => {
    const HTML_VIAJE = `
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
                    <a href="https://account.netflix.com/account/travel/verify?nftoken=AQAAAYw...&amp;action=travel&amp;locale=es-US" target="_blank" style="background:#E50914;color:#fff;">
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
              <a href="https://help.netflix.com/es/node/12345">Centro de ayuda</a> |
              <a href="https://www.netflix.com/privacy">Privacidad</a>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const result = extractCode('', 'viajenet', HTML_VIAJE);
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
    expect(result!.expiraEn).toBe(15);
    expect(result!.codigo).toBe('https://account.netflix.com/account/travel/verify?nftoken=AQAAAYw...&action=travel&locale=es-US');
    expect(result!.codigo).not.toContain('&amp;');
  });

  it('Caso 2: Email de actualizar hogar con botón "Sí, fui yo" / "Actualizar Hogar con Netflix" sin PIN', () => {
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

  it('Caso 2b: Email de actualizar hogar con botón en portugués "Atualizar Residência Netflix"', () => {
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

  it('Caso 3: Email con PIN tradicional numérico para Netflix (hogarnet)', () => {
    const TEXT_BODY = `
      Netflix
      Tu código de verificación para configurar tu Hogar con Netflix es:

      849201

      Este código vence en 15 minutos. No lo compartas con nadie.
    `;
    const HTML_BODY = `
      <html><body>
        <a href="https://www.netflix.com/"><img src="logo.png"></a>
        <p>Tu código de verificación para configurar tu Hogar con Netflix es:</p>
        <h1>849201</h1>
      </body></html>
    `;

    const result = extractCode(TEXT_BODY, 'hogarnet', HTML_BODY);
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('numerico');
    expect(result!.codigo).toBe('849201');
    expect(result!.expiraEn).toBeUndefined();
  });

  it('Caso 4: Descarte de URLs inválidas (logo, ayuda, browse) cuando no hay botón de acción ni PIN', () => {
    const HTML_SOLO_NOISE = `
      <html>
      <body>
        <a href="https://www.netflix.com/"><img src="logo.png" alt="Netflix"></a>
        <p>Gracias por ser miembro de Netflix. Consulta las novedades en tu catálogo.</p>
        <a href="https://www.netflix.com/browse">Ir a explorar títulos</a>
        <a href="https://help.netflix.com/es/node/412">Centro de ayuda</a>
        <a href="https://www.netflix.com/privacy">Aviso de privacidad</a>
      </body>
      </html>
    `;

    const result = extractCode('', 'hogarnet', HTML_SOLO_NOISE);
    expect(result).toBeNull();

    const resultViaje = extractCode('', 'viajenet', HTML_SOLO_NOISE);
    expect(resultViaje).toBeNull();
  });

  it('Caso 5: Email de inicio de sesión de Netflix (ininet) con código numérico multilínea', () => {
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
