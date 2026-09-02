import { Timestamp } from 'firebase/firestore';

/**
 * Convierte de manera segura cualquier representación de fecha (Firestore Timestamp,
 * Date, ISO string, epoch number en s o ms, o { seconds, nanoseconds }) a un objeto Date.
 */
export function parseDate(val: unknown): Date | null {
  if (val === null || val === undefined) return null;

  // 1. Date object
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // 2. Firestore Timestamp / object with toDate() or seconds
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    if (typeof obj.toDate === 'function') {
      try {
        const d = (obj.toDate as () => Date)();
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      } catch {
        // ignore
      }
    }
    if (typeof obj.seconds === 'number') {
      const ms = obj.seconds * 1000 + Math.floor(((obj.nanoseconds as number) || 0) / 1e6);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof obj._seconds === 'number') {
      const ms = obj._seconds * 1000 + Math.floor(((obj._nanoseconds as number) || 0) / 1e6);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // 3. Epoch number
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    const ms = val < 1e11 ? val * 1000 : val;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // 4. String (ISO string, YYYY-MM-DD, numeric string, etc.)
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      const ms = num < 1e11 ? num * 1000 : num;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const d = new Date(`${trimmed}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Retorna la fecha convertida a milisegundos desde epoch o null.
 */
export function parseDateToMs(val: unknown): number | null {
  const d = parseDate(val);
  return d ? d.getTime() : null;
}

/**
 * Formatea una fecha de forma segura con fallback a '—'.
 */
export function formatDate(
  val: unknown,
  locale = 'es-CO',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseDate(val);
  if (!d) return '—';
  try {
    return d.toLocaleDateString(locale, options);
  } catch {
    return d.toLocaleDateString('es-CO');
  }
}

/**
 * Convierte cualquier fecha válida a un Timestamp de Firestore.
 */
export function toFirestoreTimestamp(val: unknown): Timestamp | null {
  const d = parseDate(val);
  if (!d) return null;
  return Timestamp.fromDate(d);
}
