export const CODE_PATTERNS: Record<string, RegExp> = {
  viajenet: /(?:\bc[oó]digo\b|verification|de verificaci[oó]n).*?(\b\d{4,8}\b)/i,
  hogarnet: /(?:\bc[oó]digo\b|verification).*?(\b\d{4,8}\b)/i,
  resetnet: /(?:\bc[oó]digo\b|reset|restablecer).*?(\b\d{4,8}\b)/i,
  ininet: /(?:\bc[oó]digo\b|inicio sesi[oó]n|sign in).*?(\b\d{4,6}\b)/i,
  wincode: /(?:\bc[oó]digo\b).*?(\b\d{4,8}\b)/i,
  cgptcode: /(?:verification code|c[oó]digo).*?(\b\d{4,8}\b)/i,
  univer1: /(?:c[oó]digo|code).*?(\b\w{4,8}\b)/i,
  accmax: /(?:c[oó]digo|code|acceso).*?(\b\w{4,8}\b)/i,
};

export const GENERIC_CODE = /(\b\d{4,8}\b)/;
