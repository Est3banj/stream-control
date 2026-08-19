import { getLocale, MONEDA_POR_DEFECTO, TASA_POR_DEFECTO } from '../types/usuario';

/**
 * Formatea un valor numérico con el símbolo y formato de la moneda indicada.
 * NO hace conversión — el valor se muestra tal cual, solo se adapta el
 * símbolo monetario, separadores de miles/decimales según el locale.
 *
 * Para valores que están expresados en COP y necesitan convertirse a la
 * moneda destino, usá `formatearDesdeBase`.
 *
 * Ejemplos (usuario con moneda USD):
 *   formatearPrecio(4.21, 'USD')    → "$4.21"
 *   formatearPrecio(14000, 'COP')   → "$14.000"
 *   formatearPrecio(150, 'MXN')     → "$150"
 *   formatearPrecio(8.50, 'PEN')    → "S/8.50"
 */
export function formatearPrecio(
  valor: number,
  moneda = MONEDA_POR_DEFECTO,
): string {
  const locale = getLocale(moneda);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(valor);
  } catch {
    // Fallback si la moneda no es válida
    return `$${valor.toLocaleString(locale)}`;
  }
}

/**
 * Convierte un monto expresado en COP a la moneda destino usando la tasa
 * de cambio y lo formatea.
 *
 * Útil para precios de planes, suscripciones y valores del sistema que
 * están almacenados en COP como moneda base.
 *
 * Ejemplos:
 *   formatearDesdeBase(30000, 'MXN', 0.0045) → "$135"
 *   formatearDesdeBase(30000, 'COP', 1)      → "$30.000"
 */
export function formatearDesdeBase(
  montoCOP: number,
  moneda = MONEDA_POR_DEFECTO,
  tasa = TASA_POR_DEFECTO,
): string {
  const tasaSegura = tasa > 0 ? tasa : TASA_POR_DEFECTO;
  return formatearPrecio(montoCOP * tasaSegura, moneda);
}
