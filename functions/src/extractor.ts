/**
 * Extractor puro de códigos de verificación y URLs de acción (sin dependencias IMAP).
 *
 * Resuelve:
 * - Decodificación exhaustiva de entidades HTML (&amp;, &quot;, &#39;, entidades numéricas dec/hex, etc.).
 * - Detección de URLs de acción de Netflix (isActionUrl) con rutas y parámetros específicos.
 * - Filtro de ruido y exclusión (isNoiseUrl) para descartar logos, enlaces de ayuda, browse, login, etc.
 * - Normalización y regex de botones insensible a mayúsculas/minúsculas con soporte para tags HTML anidados
 *   (<span>, <strong>, etc.) y variantes multilingües (ES / EN / PT).
 * - Fallback inteligente de hogarnet: busca PIN numérico primero; si no existe, inspecciona todos los
 *   <a> buscando la URL de acción real en lugar del logo.
 */

// ── Tabla de decode de entidades HTML ──────────────────────────────────────

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
  '&copy;': '©',
  '&reg;': '®',
};

const ENTITY_NAMED_RE = /&(?:amp|lt|gt|quot|apos|nbsp|oacute|aacute|eacute|iacute|uacute|ntilde|uuml|Aacute|Eacute|Iacute|Oacute|Uacute|Ntilde|Uuml|copy|reg);/g;

export function decodeEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return _;
      }
    })
    .replace(ENTITY_NAMED_RE, (entity) => ENTITY_MAP[entity] ?? entity);
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

// ── Normalización de texto de anchor / botón ────────────────────────────

export function normalizeAnchorText(text: string): string {
  // Quitar etiquetas HTML anidadas (<span>, <strong>, etc.) antes de normalizar
  const textWithoutTags = text.replace(/<[^>]+>/g, ' ');

  return decodeEntities(textWithoutTags)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Quitar diacríticos / tildes
}

// ── Hosts de confianza ──────────────────────────────────────────────────

const TRUSTED_HOSTS = ['netflix.com'];

export function isTrustedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return TRUSTED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

// ── Filtro de ruido y exclusiones de Netflix ────────────────────────────

const NOISE_HOSTS = [
  'help.netflix.com',
  'devices.netflix.com',
  'jobs.netflix.com',
  'ir.netflix.com',
  'media.netflix.com',
  'customercare.netflix.com',
];

const NOISE_PATH_PATTERNS = [
  /^\/?$/, // root '/' o vacío (logo)
  /^\/login/i,
  /^\/browse/i,
  /^\/youraccount\/?$/i,
  /^\/youraccount\/payment/i,
  /^\/gift-cards/i,
  /^\/privacy/i,
  /^\/termsofuse/i,
  /^\/terms/i,
  /^\/email\/unsubscribe/i,
  /^\/managedevices/i,
  /^\/cancel/i,
  /^\/help/i,
  /^\/title\//i,
];

const ACTION_PATH_KEYWORDS = [
  '/account/travel/verify',
  '/account/update-primary-location',
  '/account/set-primary-location',
  '/household/update',
  '/youraccounttravel',
  '/verify',
  '/email/click',
  '/account/travel',
  '/update-primary-location',
  '/set-primary-location',
  '/household',
];

const ACTION_PARAM_NAMES = ['token', 'nftoken', 'nftok'];

/**
 * Determina si una URL corresponde a enlaces genéricos o informativos que deben ignorarse
 * (logo de Netflix, centro de ayuda, términos, login, etc.).
 */
export function isNoiseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    // Subdominios de ayuda, dispositivos o soporte
    if (NOISE_HOSTS.some((h) => host === h || host.endsWith('.' + h))) {
      return true;
    }

    const path = parsed.pathname;
    const hasActionParam = ACTION_PARAM_NAMES.some((p) => parsed.searchParams.has(p));

    // Si tiene parámetros de acción explícitos o rutas de acción conocidas, no es ruido
    if (hasActionParam) return false;
    if (ACTION_PATH_KEYWORDS.some((kw) => path.toLowerCase().includes(kw))) return false;

    // Rutas genéricas sin tokens (ej: '/' -> logo, '/browse', '/privacy')
    if (NOISE_PATH_PATTERNS.some((re) => re.test(path))) {
      return true;
    }

    return false;
  } catch {
    return true; // URLs no parseables son tratadas como ruido
  }
}

/**
 * Detecta si una URL es una URL de acción legítima de Netflix para verificación,
 * viaje o actualización de hogar.
 */
export function isActionUrl(url: string): boolean {
  if (!isTrustedHost(url)) return false;
  if (isNoiseUrl(url)) return false;

  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    // 1. Verificación por ruta de acción
    if (ACTION_PATH_KEYWORDS.some((kw) => path.includes(kw))) {
      return true;
    }

    // 2. Verificación por parámetros de token o acción
    if (ACTION_PARAM_NAMES.some((p) => parsed.searchParams.has(p))) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ── Patrones normalizados del texto del botón de acción ─────────────────

const ANCHOR_TEXT_PATTERNS = [
  // Obtener código variants (ES / EN / PT)
  'obtener codigo',
  'obtener tu codigo',
  'obtener codigo de acceso',
  'get code',
  'get your code',
  'get access code',
  'obter codigo',
  'obter o codigo',
  'obter seu codigo',
  'obtenha o codigo',

  // Actualizar / Confirmar Hogar variants (ES / EN / PT)
  'actualizar hogar',
  'actualizar hogar con netflix',
  'actualiza tu hogar',
  'actualizar tu hogar',
  'confirmar hogar',
  'confirma tu hogar',
  'confirmar mi hogar',
  'configurar hogar',
  'update netflix household',
  'update household',
  'confirm household',
  'set primary location',
  'update primary location',
  'atualizar residencia',
  'atualizar residencia netflix',
  'atualizar sua residencia',
  'confirmar residencia',

  // "Sí, fui yo" / "Yes, was me" variants (ES / EN / PT)
  'si, fui yo',
  'si fui yo',
  'si, era yo',
  'si era yo',
  'fui yo',
  'yes, this was me',
  'yes this was me',
  'yes, it was me',
  'yes it was me',
  'yes, that was me',
  'yes that was me',
  'this was me',
  'it was me',
  'sim, fui eu',
  'sim fui eu',
  'sim, fui eu mesmo',
  'fui eu',

  // Ver código / links
  'ver codigo',
  'ver tu codigo',
  'ver enlace',
  'ver link',
  'view code',
  'see code',
  'obtener enlace',
  'obtener link',

  // Continuar / Verificar
  'continuar con la solicitud',
  'confirmar solicitud',
  'continuar',
  'verificar',
  'verify',
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
 * @param caso - nombre del caso (viajenet, hogarnet, resetnet, etc.)
 * @param html - HTML crudo (parsed.html) para buscar anchors y botones
 */
export function extractCode(body: string, caso: string, html?: string): ExtractedCode | null {
  if (!body && !html) return null;

  // 1. "Estoy de viaje" (viajenet): Netflix siempre envía botón/link
  if (caso === 'viajenet') {
    const linkResult = extractLink(body, html, caso);
    if (linkResult) return linkResult;

    // Fallback por si viniese un código numérico
    const numFallback = extractNumericCode(body || html || '', caso);
    if (numFallback) return numFallback;

    return null;
  }

  // 2. "Código Hogar" (hogarnet): busca PIN numérico primero; si no hay, busca enlace de acción
  if (caso === 'hogarnet') {
    const numResult = extractNumericCode(body, caso) || (html ? extractNumericCode(html, caso) : null);
    if (numResult) return numResult;

    const linkResult = extractLink(body, html, caso);
    if (linkResult) return linkResult;

    // Fallback a código genérico
    const genericFallback = extractGenericCode(body || html || '');
    if (genericFallback) return genericFallback;

    return null;
  }

  // 3. Resto de casos (resetnet, ininet, wincode, etc.): buscar código numérico primero
  const numResult = extractNumericCode(body, caso) || (html ? extractNumericCode(html, caso) : null);
  if (numResult) return numResult;

  // Fallback para casos donde mandan link de reset o confirmación
  const linkFallback = extractLink(body, html, caso);
  if (linkFallback) return linkFallback;

  return null;
}

// ── Extracción de links ──────────────────────────────────────────────────

function sanitizeHref(rawHref: string): string {
  let href = decodeEntities(rawHref.trim());

  // Protocol-relative: //www.netflix.com/...
  if (href.startsWith('//')) {
    href = 'https:' + href;
  }

  // Relativo: /account/verify?token=abc
  if (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
    href = 'https://www.netflix.com' + (href.startsWith('/') ? '' : '/') + href;
  }

  // Limpiar puntuación trailing
  return cleanTrailingPunctuation(href);
}

function extractLink(body: string, html: string | undefined, caso: string): ExtractedCode | null {
  // Estrategia 1: inspeccionar todos los anchors <a> en el HTML
  if (html) {
    const anchorLink = extractLinkFromAnchors(html, caso);
    if (anchorLink) return anchorLink;
  }

  // Estrategia 2: buscar URLs en el texto plano
  if (body) {
    const urlFromText = extractUrlFromText(body);
    if (urlFromText) {
      return { codigo: urlFromText, tipo: 'link', expiraEn: 15 };
    }
  }

  // Estrategia 3: buscar URLs directas en el HTML (fallback)
  if (html) {
    const urlFromHtml = extractUrlFromText(html);
    if (urlFromHtml) {
      return { codigo: urlFromHtml, tipo: 'link', expiraEn: 15 };
    }
  }

  return null;
}

/**
 * Inspecciona todos los tags <a> del HTML buscando:
 * 1. Anchors cuyo texto coincida con los patrones de botón de acción y apunten a host confiable no ruidoso.
 * 2. Anchors cuyo href sea explícitamente una URL de acción (isActionUrl).
 * 3. Anchors que apunten a host confiable descartando ruido (logo, help, etc.).
 */
function extractLinkFromAnchors(html: string, _caso: string): ExtractedCode | null {
  const anchorRe = /<a\s+(?:[^>]*?\s+)?href=(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;

  interface Candidate {
    href: string;
    text: string;
    normalizedText: string;
    isButtonTextMatch: boolean;
    isAction: boolean;
  }

  const candidates: Candidate[] = [];

  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) !== null) {
    const rawHref = match[1] ?? match[2] ?? match[3] ?? '';
    const rawInner = match[4] ?? '';

    if (!rawHref) continue;

    const href = sanitizeHref(rawHref);
    if (!isTrustedHost(href) || isNoiseUrl(href)) continue;

    const normalizedText = normalizeAnchorText(rawInner);
    const isButtonTextMatch = ANCHOR_TEXT_PATTERNS.some((p) => normalizedText.includes(p));
    const isAction = isActionUrl(href);

    candidates.push({
      href,
      text: rawInner,
      normalizedText,
      isButtonTextMatch,
      isAction,
    });
  }

  // Prioridad 1: Coincidencia de texto de botón de acción
  const buttonMatch = candidates.find((c) => c.isButtonTextMatch);
  if (buttonMatch) {
    return { codigo: buttonMatch.href, tipo: 'link', expiraEn: 15 };
  }

  // Prioridad 2: URL de acción detectada (ej. /account/travel/verify o con token)
  const actionMatch = candidates.find((c) => c.isAction);
  if (actionMatch) {
    return { codigo: actionMatch.href, tipo: 'link', expiraEn: 15 };
  }

  // Prioridad 3: Primer candidato confiable que sobrevivió al filtro de ruido
  if (candidates.length > 0) {
    return { codigo: candidates[0].href, tipo: 'link', expiraEn: 15 };
  }

  return null;
}

/**
 * Busca URLs en texto plano o HTML descartando URLs de ruido y priorizando action URLs.
 */
function extractUrlFromText(text: string): string | null {
  const decoded = decodeEntities(text);
  const urlRe = /https?:\/\/[^\s"'<>)\]]+/gi;

  const validUrls: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = urlRe.exec(decoded)) !== null) {
    let url = cleanTrailingPunctuation(match[0]);
    if (isTrustedHost(url) && !isNoiseUrl(url)) {
      if (isActionUrl(url)) {
        return url; // Prioridad inmediata si es URL de acción
      }
      validUrls.push(url);
    }
  }

  return validUrls.length > 0 ? validUrls[0] : null;
}

// ── Extracción de código numérico ────────────────────────────────────────

const CODE_PATTERNS: Record<string, RegExp> = {
  hogarnet: /(?:\b(?:c[oó]digo|code|verification)\b)[\s\S]*?(\b\d{4,8}\b)/i,
  resetnet: /(?:\b(?:c[oó]digo|code|reset|restablecer|redefinir)\b)[\s\S]*?(\b\d{4,8}\b)/i,
  ininet:   /(?:\b(?:c[oó]digo|code|inicio sesi[oó]n|iniciar sesi[oó]n|sign in)\b)[\s\S]*?(\b\d{4,6}\b)/i,
  wincode:  /(?:\b(?:c[oó]digo|code)\b)[\s\S]*?(\b\d{4,8}\b)/i,
  cgptcode: /(?:\b(?:verification code|c[oó]digo|code)\b)[\s\S]*?(\b\d{4,8}\b)/i,
  univer1:  /(?:\b(?:c[oó]digo|code)\b)[\s\S]*?(\b\w{4,8}\b)/i,
  accmax:   /(?:\b(?:c[oó]digo|code|acceso)\b)[\s\S]*?(\b\w{4,8}\b)/i,
};

const GENERIC_CODE = /(\b\d{4,8}\b)/;

function extractNumericCode(body: string, caso: string): ExtractedCode | null {
  if (!body) return null;

  const decoded = decodeEntities(body);
  const pattern = CODE_PATTERNS[caso];
  if (pattern) {
    const match = decoded.match(pattern);
    if (match?.[1]) {
      return { codigo: match[1], tipo: 'numerico' };
    }
  }

  return null;
}

function extractGenericCode(text: string): ExtractedCode | null {
  if (!text) return null;
  const decoded = decodeEntities(text);
  const match = decoded.match(GENERIC_CODE);
  if (match?.[1]) {
    return { codigo: match[1], tipo: 'numerico' };
  }
  return null;
}
