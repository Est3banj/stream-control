import { useAuth } from '../contexts/AuthContext';
import { formatearPrecio, formatearDesdeBase as fb } from '../utils/formatearPrecio';
import { MONEDA_POR_DEFECTO, TASA_POR_DEFECTO } from '../types/usuario';
import type { Moneda } from '../types/usuario';
import { MONEDAS } from '../types/usuario';

/**
 * Hook que proporciona la moneda del usuario autenticado
 * y dos funciones de formateo:
 *
 * - `formatear(valor)` — sin conversión, SOLO formatea con símbolo/locale
 *   (para ventas, reportes, cuentas — valores ya en moneda local)
 *
 * - `formatearDesdeBase(montoCOP)` — aplica la tasa de cambio al monto
 *   (para precios de planes, suscripciones del sistema — valores base en COP)
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
   * Formatea el monto de una venta considerando en qué moneda se registró.
   * Si la venta tiene monedaVenta/tasaVenta, convierte automáticamente
   * a la moneda actual del usuario. Si no tiene (ventas viejas), asume COP.
   */
  const formatearDesdeVenta = (monto: number, monedaVenta?: string, tasaVenta?: number): string => {
    if (!monedaVenta || !tasaVenta || monedaVenta === moneda) {
      return formatearPrecio(monto, moneda);
    }
    const enCOP = monto / tasaVenta;
    const enActual = enCOP * tasaEfectiva;
    return formatearPrecio(enActual, moneda);
  };

  return { moneda, simbolo: info?.simbolo || '$', tasa: tasaEfectiva, formatear, formatearDesdeBase, formatearDesdeVenta };
}
