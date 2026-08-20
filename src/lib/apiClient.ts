import { getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL ?? 'https://api.streamcontrol.pro');

export class ApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = `functions/${code}`;
    this.name = 'ApiError';
  }
}

export async function callFunction<T = unknown, R = unknown>(fn: string, data?: T): Promise<R> {
  let token = '';
  try {
    const user = getAuth(getApp()).currentUser;
    if (user) token = await user.getIdToken();
  } catch {
    token = '';
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ data: data ?? null }),
    });
  } catch {
    throw new ApiError('unavailable', 'Unavailable: No se pudo conectar al servidor');
  }

  if (res.status === 502 || res.status === 504) {
    throw new ApiError('unavailable', 'Unavailable: el servidor no respondió correctamente');
  }

  let payload: { result?: unknown; error?: { code?: string; message?: string } };
  try {
    payload = await res.json();
  } catch {
    throw new ApiError('unavailable', 'Unavailable: respuesta inválida del servidor');
  }

  if (!res.ok || payload.error) {
    throw new ApiError(payload?.error?.code ?? 'internal', payload?.error?.message ?? 'Error del servidor');
  }

  if (payload.result === undefined) {
    throw new ApiError('unavailable', 'Unavailable: el servidor no devolvió un resultado');
  }

  return payload.result as R;
}