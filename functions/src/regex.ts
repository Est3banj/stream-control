export const CODE_PATTERNS: Record<string, RegExp> = {
  viajenet: /(?:\bc[oó]digo\b|verification|de verificaci[oó]n).*?(\d{6})/i,
  hogarnet: /(?:\bc[oó]digo\b|verification).*?(\d{6})/i,
  resetnet: /(?:\bc[oó]digo\b|reset|restablecer).*?(\d{6})/i,
  ininet: /(?:\bc[oó]digo\b|inicio sesi[oó]n|sign in).*?(\d{6})/i,
  wincode: /(?:\bc[oó]digo\b).*?(\d{6})/i,
  cgptcode: /(?:verification code|c[oó]digo).*?(\d{6})/i,
  univer1: /(?:c[oó]digo|code).*?(\w{4,8})/i,
  accmax: /(?:c[oó]digo|code|acceso).*?(\w{4,8})/i,
};

export const GENERIC_CODE = /(\d{6})/;
