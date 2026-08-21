/**
 * Extractor puro de códigos de verificación (sin dependencias IMAP).
 * Opción A del diseño: regex normalizado + decode de entidades + trailing cleanup.
 * Bugs que resuelve: entidades HTML (&amp;), trailing punctuation (.), subdominios,
 * href protocol-relative, y propagación correcta de tipo/expiraEn.
 */

// ── Tabla de decode de entidades HTML (relevantes para URLs) ──────────────

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&oacute;': 'ó',
  '&aacute;': 'á',
  '&eacute;': 'é',
  '&iacute;': 'í',
  '&uacute;': 'ú',
  '&ntilde;': 'ñ',
  '&uuml;': 'ü',
  '&Aacute;': 'Á',
  '&Eacute;': 'É',
  '&Iacute;': 'Í',
  '&Oacute;': 'Ó',
  '&Uacute;': 'Ú',
  '&Ntilde;': 'Ñ',
  '&Uuml;': 'Ü',
};

const ENTITY_RE = /&(?:amp|lt|gt|quot|apos|nbsp|#[0-9]+|#[xX][0-9a-fA-F]+|oacute|aacute|eacute|iacute|uacute|ntilde|uuml|Aacute|Eacute|Iacute|Oacute|Uacute|Ntilde|Uuml);/g;

export function decodeEntities(text: string): string {
  return text.replace(ENTITY_RE, (entity) => ENTITY_MAP[entity] ?? entity);
}

// ── Limpieza de puntuación trailing con re-balance de paréntesis ─────────

export function cleanTrailingPunctuation(url: string): string {
  let cleaned = url.replace(/[),.;:\]]+$/g, '');

  // Re-balance: si hay más '(' que ')' al final, quitar el '(' sobrante
  const openCount = (cleaned.match(/\(/g) ?? []).length;
  const closeCount = (cleaned.match(/\)/g) ?? []).length;
  if (openCount > closeCount) {
    cleaned = cleaned.replace(/\(+$/, '');
  }

  return cleaned;
}

// ── Normalización de texto del anchor (botón) ────────────────────────────

export function normalizeAnchorText(text: string): string {
  return decodeEntities(text)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quitar diacríticos
}

// ── Hosts de confianza (endsWith para cubrir subdominios) ────────────────

const TRUSTED_HOSTS = ['netflix.com'];

export function isTrustedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return TRUSTED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

// ── Patrones normalizados del botón ──────────────────────────────────────

/**
 * Variantes normalizadas del texto del botón "Obtener código".
 * Cada patrón matchea contra texto normalizado (lowercase, sin acentos, sin &amp;).
 */
const ANCHOR_TEXT_PATTERNS = [
  'obtener codigo',
  'get code',
  'obtener tu codigo',
  'obtener codigo de acceso',
  'ver codigo',
  'ver tu codigo',
  'obtener enlace',
  'ver enlace',
  'obtener link',
  'ver link',
];

// ── Resultado del extractor ──────────────────────────────────────────────

export interface ExtractedCode {
  codigo: string;
  tipo: 'numerico' | 'link';
  expiraEn?: number; // minutos (15 para links, undefined para numéricos)
}

// ── Función principal ────────────────────────────────────────────────────

/**
 * Extrae código o URL del body de un email.
 * @param body - texto plano (parsed.text)
 * @param caso - nombre del caso (viajenet, hogarnet, etc.)
 * @param html - HTML crudo (parsed.html) para buscar anchors
 */
export function extractCode(body: string, caso: string, html?: string): ExtractedCode | null {
  if (!body && !html) return null;

  // Casos que producen links por diseño
  const linkCases = ['viajenet', 'hogarnet'];

  if (linkCases.includes(caso)) {
    const linkResult = extractLink(body, html, caso);
    if (linkResult) return linkResult;
  }

  // Fallback: código numérico
  const numResult = extractNumericCode(body, caso);
  if (numResult) return numResult;

  return null;
}

// ── Extracción de links ──────────────────────────────────────────────────

function extractLink(body: string, html: string | undefined, caso: string): ExtractedCode | null {
  // Estrategia 1: buscar anchor en HTML con texto normalizado matcheado
  if (html) {
    const anchorLink = extractLinkFromAnchor(html, caso);
    if (anchorLink) return anchorLink;
  }

  // Estrategia 2: buscar URL en texto plano (URL-first como ejstore)
  const urlFromText = extractUrlFromText(body || html || '');
  if (urlFromText) {
    return { codigo: urlFromText, tipo: 'link', expiraEn: 15 };
  }

  // Estrategia 3: buscar URL en HTML (fallback)
  if (html) {
    const urlFromHtml = extractUrlFromText(html);
    if (urlFromHtml) {
      return { codigo: urlFromHtml, tipo: 'link', expiraEn: 15 };
    }
  }

  return null;
}

/**
 * Busca un <a> cuyo texto normalizado matchee variantes de "obtener código"
 * y cuyo href apunte a un host de confianza.
 */
function extractLinkFromAnchor(html: string, caso: string): ExtractedCode | null {
  // Regex: captura href (con comillas dobles o simples) y el texto del anchor
  const anchorRe = /<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) !== null) {
    const rawHref = match[1];
    const rawText = match[2];

    // Decodificar y normalizar el texto del anchor
    const normalizedText = normalizeAnchorText(rawText);

    // Verificar si el texto matchea alguna variante del botón
    const textMatches = ANCHOR_TEXT_PATTERNS.some((p) => normalizedText.includes(p));

    if (!textMatches) continue;

    // Procesar el href
    let href = decodeEntities(rawHref);

    // Protocol-relative: //www.netflix.com/...
    if (href.startsWith('//')) {
      href = 'https:' + href;
    }

    // Relativo: /account/verify?token=abc
    if (!href.startsWith('http')) {
      href = 'https://www.netflix.com' + (href.startsWith('/') ? '' : '/') + href;
    }

    // Limpiar trailing punctuation
    href = cleanTrailingPunctuation(href);

    // Verificar host de confianza
    if (isTrustedHost(href)) {
      return { codigo: href, tipo: 'link', expiraEn: 15 };
    }
  }

  return null;
}

/**
 * Busca la primera URL en texto plano/HTML que apunte a un host de confianza.
 */
function extractUrlFromText(text: string): string | null {
  // Decode entidades primero (puede haber &amp; en URLs)
  const decoded = decodeEntities(text);

  // Buscar URLs
  const urlRe = /https?:\/\/[^\s"'<>)\]]+/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRe.exec(decoded)) !== null) {
    let url = match[0];

    // Limpiar trailing punctuation
    url = cleanTrailingPunctuation(url);

    // Verificar host de confianza
    if (isTrustedHost(url)) {
      return url;
    }
  }

  return null;
}

// ── Extracción de código numérico ────────────────────────────────────────

const CODE_PATTERNS: Record<string, RegExp> = {
  hogarnet: /(?:\b(?:c[oó]digo|code|verification)\b)[\s\S]*?(\b\d{4,8}\b)/i,
  resetnet: /(?:\b(?:c[oó]digo|code|reset|restablecer)\b)[\s\S]*?(\b\d{4,8}\b)/i,
  ininet:   /(?:\b(?:c[oó]digo|code|inicio sesi[oó]n|sign in)\b)[\s\S]*?(\b\d{4,6}\b)/i,
  wincode:  /(?:\b(?:c[oó]digo|code)\b)[\s\S]*?(\b\d{4,8}\b)/i,
  cgptcode: /(?:\b(?:verification code|c[oó]digo)\b)[\s\S]*?(\b\d{4,8}\b)/i,
  univer1:  /(?:\b(?:c[oó]digo|code)\b)[\s\S]*?(\b\w{4,8}\b)/i,
  accmax:   /(?:\b(?:c[oó]digo|code|acceso)\b)[\s\S]*?(\b\w{4,8}\b)/i,
};

const GENERIC_CODE = /(\b\d{4,8}\b)/;

function extractNumericCode(body: string, caso: string): ExtractedCode | null {
  if (!body) return null;

  const decoded = decodeEntities(body);
  const pattern = CODE_PATTERNS[caso] ?? GENERIC_CODE;
  const match = decoded.match(pattern);

  if (match?.[1]) {
    return { codigo: match[1], tipo: 'numerico' };
  }

  return null;
}
