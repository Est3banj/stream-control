// Patrones para extraer CÓDIGOS NUMÉRICOS del cuerpo del email
export const CODE_PATTERNS: Record<string, RegExp> = {
  // viajenet NO va acá — Netflix manda un link, no código numérico
  hogarnet: /(?:\bc[óo]digo\b|verification).*?(\b\d{4,8}\b)/i,
  resetnet: /(?:\bc[óo]digo\b|reset|restablecer).*?(\b\d{4,8}\b)/i,
  ininet: /(?:\bc[óo]digo\b|inicio sesi[óo]n|sign in).*?(\b\d{4,6}\b)/i,
  wincode: /(?:\bc[óo]digo\b).*?(\b\d{4,8}\b)/i,
  cgptcode: /(?:verification code|c[óo]digo).*?(\b\d{4,8}\b)/i,
  univer1: /(?:c[óo]digo|code).*?(\b\w{4,8}\b)/i,
  accmax: /(?:c[óo]digo|code|acceso).*?(\b\w{4,8}\b)/i,
};

// Patrones para extraer LINKS del HTML del email
export const LINK_PATTERNS: Record<string, RegExp> = {
  // "Estoy de viaje": Netflix manda un botón "Obtener código" con un href
  viajenet: /<a[^>]*href="([^"]*)"[^>]*>.*?Obtener código.*?<\/a>/is,
};

// Patrones para extraer URLs en texto plano (fallback cuando no hay HTML)
export const URL_PATTERNS: Record<string, RegExp> = {
  viajenet: /https?:\/\/(?:www\.)?netflix\.com\/[^\s"<>]+/i,
};

// Patrón genérico de último recurso
export const GENERIC_CODE = /(\b\d{4,8}\b)/;
