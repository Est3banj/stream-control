// Patrones para extraer CÓDIGOS NUMÉRICOS del cuerpo del email
export const CODE_PATTERNS: Record<string, RegExp> = {
  // viajenet NO va acá — Netflix manda un link, no código numérico
  hogarnet: /(?:\b(?:c[oó]digo|code|verification)\b)[\s\S]*?(\b\d{4,8}\b)/i,
  resetnet: /(?:\b(?:c[oó]digo|code|reset|restablecer|redefinir)\b)[\s\S]*?(\b\d{4,8}\b)/i,
  ininet: /(?:\b(?:c[oó]digo|code|inicio sesi[oó]n|iniciar sesi[oó]n|sign in)\b)[\s\S]*?(\b\d{4,6}\b)/i,
  wincode: /(?:\b(?:c[oó]digo|code)\b)[\s\S]*?(\b\d{4,8}\b)/i,
  cgptcode: /(?:\b(?:verification code|c[oó]digo|code)\b)[\s\S]*?(\b\d{4,8}\b)/i,
  univer1: /(?:\b(?:c[oó]digo|code)\b)[\s\S]*?(\b\w{4,8}\b)/i,
  accmax: /(?:\b(?:c[oó]digo|code|acceso)\b)[\s\S]*?(\b\w{4,8}\b)/i,
};

// Patrones para extraer LINKS del HTML del email
export const LINK_PATTERNS: Record<string, RegExp> = {
  // "Estoy de viaje": Netflix manda un botón de acción
  viajenet: /<a\s+(?:[^>]*?\s+)?href=(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>[\s\S]*?(?:obtener c[oó]digo|get code|obter c[oó]digo)[\s\S]*?<\/a>/i,
  hogarnet: /<a\s+(?:[^>]*?\s+)?href=(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>[\s\S]*?(?:actualizar hogar|confirmar hogar|s[íi], fui yo|update.*household|sim, fui eu)[\s\S]*?<\/a>/i,
};

// Patrones para extraer URLs en texto plano (fallback cuando no hay HTML)
export const URL_PATTERNS: Record<string, RegExp> = {
  viajenet: /https?:\/\/(?:[a-zA-Z0-9-]+\.)?netflix\.com\/[^\s"'<>]+/i,
  hogarnet: /https?:\/\/(?:[a-zA-Z0-9-]+\.)?netflix\.com\/[^\s"'<>]+/i,
};

// Patrón genérico de último recurso
export const GENERIC_CODE = /(\b\d{4,8}\b)/;
