import { useAuth } from '../contexts/AuthContext';
import { formatearPrecio } from '../utils/formatearPrecio';
import { MONEDA_POR_DEFECTO, TASA_POR_DEFECTO } from '../types/usuario';

/**
 * Hook que proporciona la moneda y tasa del usuario autenticado
 * y una función para formatear precios.
 */
export function useMoneda() {
  const { user } = useAuth();
  const moneda = user?.moneda || MONEDA_POR_DEFECTO;
  const tasa = user?.tasa || TASA_POR_DEFECTO;

  const formatear = (montoCOP: number): string =>
    formatearPrecio(montoCOP, moneda, tasa);

  return { moneda, tasa, formatear };
}
