/**
 * Tests del extractor puro de códigos (extractor.ts).
 * Cubre: entidades HTML, trailing punctuation, subdominios, href protocol-relative,
 * normalización de texto del anchor, semántica por caso, y fallback numérico.
 */

import { describe, expect, it } from 'vitest';
import {
  decodeEntities,
  cleanTrailingPunctuation,
  normalizeAnchorText,
  isTrustedHost,
  extractCode,
} from '../src/extractor.js';

// ── decodeEntities ───────────────────────────────────────────────────────

describe('decodeEntities', () => {
  it('decodifica &amp; a &', () => {
    expect(decodeEntities('https://x.com?a=1&amp;b=2')).toBe('https://x.com?a=1&b=2');
  });

  it('decodifica &oacute; a ó', () => {
    expect(decodeEntities('Obtener c&oacute;digo')).toBe('Obtener código');
  });

  it('decodifica &nbsp; a espacio', () => {
    expect(decodeEntities('Obtener&nbsp;código')).toBe('Obtener código');
  });

  it('decodifica múltiples entidades', () => {
    expect(decodeEntities('&amp; &lt; &gt; &quot;')).toBe('& < > "');
  });

  it('deja intacto texto sin entidades', () => {
    expect(decodeEntities('https://netflix.com/verify?x=1')).toBe('https://netflix.com/verify?x=1');
  });
});

// ── cleanTrailingPunctuation ─────────────────────────────────────────────

describe('cleanTrailingPunctuation', () => {
  it('limpia punto final', () => {
    expect(cleanTrailingPunctuation('https://x.com/a.')).toBe('https://x.com/a');
  });

  it('limpia paréntesis + punto', () => {
    expect(cleanTrailingPunctuation('https://x.com/a).')).toBe('https://x.com/a');
  });

  it('limpia coma', () => {
    expect(cleanTrailingPunctuation('https://x.com/a,')).toBe('https://x.com/a');
  });

  it('re-balancea paréntesis sin cerrar al final', () => {
    // Caso real: URL capturada con paréntesis de envoltura: (https://x.com/a)
    expect(cleanTrailingPunctuation('https://x.com/a(')).toBe('https://x.com/a');
  });

  it('NO limpia query params válidos', () => {
    expect(cleanTrailingPunctuation('https://x.com/a?b=1&c=2')).toBe('https://x.com/a?b=1&c=2');
  });

  it('limpia ] sin counterpart', () => {
    expect(cleanTrailingPunctuation('https://x.com/a]')).toBe('https://x.com/a');
  });
});

// ── normalizeAnchorText ──────────────────────────────────────────────────

describe('normalizeAnchorText', () => {
  it('normaliza "Obtener código"', () => {
    expect(normalizeAnchorText('Obtener código')).toBe('obtener codigo');
  });

  it('normaliza "Obtener&nbsp;código"', () => {
    expect(normalizeAnchorText('Obtener&nbsp;código')).toBe('obtener codigo');
  });

  it('normaliza "Get Code"', () => {
    expect(normalizeAnchorText('Get Code')).toBe('get code');
  });

  it('colapsa whitespace múltiple', () => {
    expect(normalizeAnchorText('Obtener  \n  código')).toBe('obtener codigo');
  });
});

// ── isTrustedHost ────────────────────────────────────────────────────────

describe('isTrustedHost', () => {
  it('acepta netflix.com', () => {
    expect(isTrustedHost('https://netflix.com/verify')).toBe(true);
  });

  it('acepta account.netflix.com', () => {
    expect(isTrustedHost('https://account.netflix.com/verify?x=1')).toBe(true);
  });

  it('rechaza evil.netflix.com.fake.com', () => {
    expect(isTrustedHost('https://evil.netflix.com.fake.com/x')).toBe(false);
  });

  it('rechaza example.com', () => {
    expect(isTrustedHost('https://example.com/x')).toBe(false);
  });
});

// ── extractCode — links ──────────────────────────────────────────────────

describe('extractCode — viajenet (links)', () => {
  const HTML_VIAJENET = `
    <html><body>
      <a href="https://account.netflix.com/account/verify?token=abc123&amp;action=travel">Obtener código</a>
    </body></html>
  `;

  it('extrae link del anchor con &amp; en href (BUG P0)', () => {
    const result = extractCode('', 'viajenet', HTML_VIAJENET);
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
    expect(result!.codigo).toContain('token=abc123&action=travel'); // &amp; decodificado
    expect(result!.codigo).not.toContain('&amp;');
  });

  it('extrae link con trailing punctuation (BUG P0)', () => {
    const html = `<a href="https://account.netflix.com/verify?x=1">Obtener código</a>.`;
    const result = extractCode('', 'viajenet', html);
    expect(result).not.toBeNull();
    expect(result!.codigo).not.toMatch(/[).,]$/);
  });

  it('extrae link de account.netflix.com (BUG P1 — subdominio)', () => {
    const result = extractCode('', 'viajenet', HTML_VIAJENET);
    expect(result).not.toBeNull();
    expect(result!.codigo).toContain('account.netflix.com');
  });

  it('extrae link de href con comillas simples (BUG D7)', () => {
    const html = `<a href='https://account.netflix.com/verify?x=1'>Obtener código</a>`;
    const result = extractCode('', 'viajenet', html);
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
  });

  it('extrae URL de texto plano como fallback', () => {
    const text = 'Visita https://account.netflix.com/verify?token=xyz para verificar.';
    const result = extractCode(text, 'viajenet');
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
    expect(result!.codigo).toContain('account.netflix.com');
  });

  it('no extrae link de host no confiable', () => {
    const html = `<a href="https://evil.com/steal">Obtener código</a>`;
    const result = extractCode('', 'viajenet', html);
    expect(result).toBeNull();
  });

  it('devuelve expiraEn 15 para links', () => {
    const result = extractCode('', 'viajenet', HTML_VIAJENET);
    expect(result!.expiraEn).toBe(15);
  });
});

describe('extractCode — hogarnet (numérico primero, link fallback)', () => {
  it('extrae código numérico cuando existe', () => {
    const text = 'Tu código de verificación es 123456. No lo compartas.';
    const result = extractCode(text, 'hogarnet');
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('numerico');
    expect(result!.codigo).toBe('123456');
  });

  it('extrae link cuando no hay numérico', () => {
    const html = `<a href="https://account.netflix.com/verify?x=1">Obtener código</a>`;
    const result = extractCode('', 'hogarnet', html);
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('link');
  });
});

// ── extractCode — numéricos ──────────────────────────────────────────────

describe('extractCode — códigos numéricos', () => {
  it('extrae código de wincode', () => {
    const text = 'Tu código: 456789';
    const result = extractCode(text, 'wincode');
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('numerico');
    expect(result!.codigo).toBe('456789');
  });

  it('extrae código de Netflix con saltos de línea (BUG: .+? no cruzaba newlines)', () => {
    const text = `Ingresa este código para iniciar sesión

Ingresa este código para iniciar sesión

6214

Ingresa este código en tu dispositivo para iniciar sesión
en Netflix. El código vence en 15 minutos.`;
    const result = extractCode(text, 'ininet');
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('numerico');
    expect(result!.codigo).toBe('6214');
  });

  it('extrae código genérico sin caso específico', () => {
    const text = 'Verification code: 123456';
    const result = extractCode(text, 'desconocido');
    expect(result).not.toBeNull();
    expect(result!.tipo).toBe('numerico');
  });

  it('devuelve null si no hay nada', () => {
    const result = extractCode('sin código aquí', 'viajenet');
    expect(result).toBeNull();
  });
});
