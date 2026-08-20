import { useAuth } from '../contexts/AuthContext';
import { formatearPrecio, formatearDesdeBase as fb } from '../utils/formatearPrecio';
import { MONEDA_POR_DEFECTO, TASA_POR_DEFECTO } from '../types/usuario';
import type { Moneda } from '../types/usuario';
import { MONEDAS } from '../types/usuario';

/**
 * Hook que proporciona la moneda del usuario autenticado
 * y funciones de formateo con conversión automática:
 *
 * - `formatear(valor)` — sin conversión, SOLO formatea con símbolo/locale
 * - `formatearDesdeBase(montoCOP)` — aplica la tasa de cambio al monto
 * - `formatearDesdeVenta(monto, monedaVenta, tasaVenta)` — formatea una venta
 *   considerando su moneda original, convirtiendo a la moneda actual del usuario
 * - `convertirVenta(monto, monedaVenta, tasaVenta)` — convierte el número sin formatear,
 *   útil para sumatorias y cálculos financieros
 */
export function useMoneda() {
  const { user } = useAuth();
  const moneda: string = user?.moneda || MONEDA_POR_DEFECTO;
  const tasa: number = user?.tasa ?? TASA_POR_DEFECTO;

  const info: Moneda | undefined = MONEDAS.find(m => m.codigo === moneda);
  const tasaEfectiva = tasa > 0 ? tasa : (info?.defTasa ?? TASA_POR_DEFECTO);

  const formatear = (valor: number): string =>
    formatearPrecio(valor, moneda);

  const formatearDesdeBase = (montoCOP: number): string =>
    fb(montoCOP, moneda, tasaEfectiva);

  /**
   * Convierte el monto de una venta a la moneda actual del usuario.
   * Si la venta no tiene monedaVenta (datos viejos), asume que está en COP.
   */
  const convertirVenta = (monto: number, monedaVenta?: string, tasaVenta?: number): number => {
    if (!monedaVenta || !tasaVenta) {
      // Ventas viejas: estaban en COP, convertir a moneda actual
      return monto * tasaEfectiva;
    }
    if (monedaVenta === moneda) {
      return monto;
    }
    // Ventas en otra moneda: convertir a COP, luego a moneda actual
    const enCOP = monto / tasaVenta;
    return enCOP * tasaEfectiva;
  };

  /**
   * Formatea el monto de una venta considerando su moneda original.
   */
  const formatearDesdeVenta = (monto: number, monedaVenta?: string, tasaVenta?: number): string =>
    formatearPrecio(convertirVenta(monto, monedaVenta, tasaVenta), moneda);

  return { moneda, simbolo: info?.simbolo || '$', tasa: tasaEfectiva, formatear, formatearDesdeBase, formatearDesdeVenta, convertirVenta };
}
