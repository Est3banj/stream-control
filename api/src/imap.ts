/**
 * Port mecánico de functions/src/imap.ts — AD-9 (timeouts nativos) ya aplicado en v2, intacto.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { extractCode } from './extractor.js';

export interface IMAPConfig {
  correo: string;
  contrasena: string;
  host: string;
  port: number;
}

export interface CodigoResult {
  codigo: string;
  /** 'numerico' = código de dígitos, 'link' = enlace para abrir */
  tipo: 'numerico' | 'link';
  fecha: string;
  remitente: string;
  asunto: string;
  /** Minutos hasta que expira (solo para links) */
  expiraEn?: number;
}

const SENDER_MAP: Record<string, string[]> = {
  Netflix: ['info@account.netflix.com', 'info@netflix.com'],
  Max: ['no-reply@max.com', 'info@hbomax.com'],
  ChatGPT: ['no-reply@openai.com'],
  Win: ['no-reply@winplay.co', 'notificaciones@claro.com.co'],
  Universal: ['no-reply@universalplus.com'],
};

// Palabras clave en el ASUNTO para filtrar por tipo de código
// Basado en asuntos reales de los emails de cada servicio
const SUBJECT_KEYWORDS: Record<string, RegExp> = {
  viajenet: /viaje|travel|acceso temporal|código.*acceso|dispositivo nuevo|nuevo dispositivo|estás viajando|fuera|solicitud.*código/i,
  hogarnet: /hogar|home|tv en casa|código hogar|confirmación.*hogar|confirma.*hogar/i,
  resetnet: /reset|restablecer|cambiar contraseña|password|restablecimiento/i,
  ininet: /inicio.*sesi[óo]n|sign in|iniciar sesi[óo]n|código.*sesi[óo]n|código.*verificación/i,
  wincode: /código|win/i,
  cgptcode: /verification|código|chatgpt|openai/i,
  univer1: /código|universal/i,
  accmax: /max|acceso|código/i,
};

const CONNECTION_TIMEOUT = 10_000;

/**
 * Extrae el valor del email usando el extractor puro (extractor.ts).
 * Resuelve: entidades HTML, trailing punctuation, subdominios, href protocol-relative.
 */
async function extractFromBody(
  parsed: any,
  caso: string
): Promise<{ codigo: string; tipo: 'numerico' | 'link' } | null> {
  const textBody = parsed.text || '';
  const htmlBody = parsed.html || '';

  const result = extractCode(textBody, caso, htmlBody);
  if (!result) return null;

  return { codigo: result.codigo, tipo: result.tipo };
}

export async function buscarCodigoVerificacion(
  config: IMAPConfig,
  servicio: string,
  caso: string
): Promise<CodigoResult | null> {
  const senders = SENDER_MAP[servicio];
  if (!senders || senders.length === 0) {
    throw new Error(`No sender mapping for servicio: ${servicio}`);
  }

  const subjectPattern = SUBJECT_KEYWORDS[caso];

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: {
      user: config.correo,
      pass: config.contrasena,
    },
    logger: false,
    connectionTimeout: CONNECTION_TIMEOUT,
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date();
      since.setDate(since.getDate() - 1);

      // Buscar TODOS los emails de los últimos 24h del remitente
      let search = await client.search({ from: senders[0], since });
      if (!Array.isArray(search)) search = [];
      if (search.length === 0 && senders.length > 1) {
        const altSearch = await client.search({ from: senders[1], since });
        if (Array.isArray(altSearch) && altSearch.length > 0) {
          search = altSearch;
        }
      }

      if (search.length === 0) return null;

      // Recorrer desde el más nuevo hacia atrás, filtrando por asunto
      for (let i = search.length - 1; i >= 0; i--) {
        const msg = await client.fetchOne(search[i], {
          source: true,
          envelope: true,
        });

        if (!msg || !msg.source) continue;

        const parsed = await simpleParser(msg.source);
        const asunto = parsed.subject || '(sin asunto)';

        // Si hay patrón de asunto para este caso, verificar que coincida
        if (subjectPattern) {
          if (parsed.subject && subjectPattern.test(parsed.subject)) {
            console.log(`[imap] Asunto COINCIDE con "${caso}": "${asunto}"`);
          } else {
            console.log(`[imap] Asunto NO coincide con "${caso}": "${asunto}"`);
            continue;
          }
        }

        const body = parsed.text || parsed.html || '';
        if (!body) continue;

        // Usar la nueva función que soporta links y códigos
        const result = await extractFromBody(parsed, caso);
        if (!result) continue;

        return {
          codigo: result.codigo,
          tipo: result.tipo,
          fecha: parsed.date?.toISOString() || new Date().toISOString(),
          remitente: parsed.from?.text || senders[0],
          asunto: parsed.subject || '',
          expiraEn: result.tipo === 'link' ? 15 : undefined,
        };
      }

      // No se encontró ningún email que coincida con el filtro de asunto
      return null;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}