import { getLocale, MONEDA_POR_DEFECTO, TASA_POR_DEFECTO } from '../types/usuario';

/**
 * Convierte un monto en COP a la moneda destino usando la tasa fija
 * y lo formatea con Intl.NumberFormat.
 *
 * Ejemplos:
 *   formatearPrecio(30000, 'MXN', 0.005)  → "$150"
 *   formatearPrecio(30000, 'CLP', 0.257)  → "$7.710"
 *   formatearPrecio(30000, 'USD', 0.00029) → "US$8,70"
 */
export function formatearPrecio(
  montoCOP: number,
  moneda = MONEDA_POR_DEFECTO,
  tasa = TASA_POR_DEFECTO,
): string {
  if (tasa <= 0) tasa = TASA_POR_DEFECTO;
  const convertido = montoCOP * tasa;
  const locale = getLocale(moneda);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(convertido);
  } catch {
    // Fallback si la moneda no es válida
    return `$${convertido.toLocaleString(locale)}`;
  }
}
