import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { CODE_PATTERNS, GENERIC_CODE } from './regex';

export interface IMAPConfig {
  correo: string;
  contrasena: string;
  host: string;
  port: number;
}

export interface CodigoResult {
  codigo: string;
  fecha: string;
  remitente: string;
  asunto: string;
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
  viajenet: /viaje|travel|dispositivo nuevo|nuevo dispositivo|estás viajando|fuera/i,
  hogarnet: /hogar|home|tv en casa|código hogar/i,
  resetnet: /reset|restablecer|cambiar contraseña|password|restablecimiento/i,
  ininet: /inicio.*sesi[oó]n|sign in|iniciar sesi[oó]n|código.*sesi[oó]n/i,
  wincode: /código|win/i,
  cgptcode: /verification|código|chatgpt|openai/i,
  univer1: /código|universal/i,
  accmax: /max|acceso|código/i,
};

const CONNECTION_TIMEOUT = 10_000;

function connectWithTimeout(client: ImapFlow, ms: number): Promise<void> {
  return Promise.race([
    client.connect(),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), ms)
    ),
  ]);
}

async function extractCodeFromBody(body: string, caso: string): Promise<string | null> {
  const pattern = CODE_PATTERNS[caso];
  if (pattern) {
    const match = body.match(pattern);
    if (match?.[1]) return match[1];
  }

  const fallback = body.match(GENERIC_CODE);
  if (fallback?.[1]) return fallback[1];

  return null;
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
  });

  try {
    await connectWithTimeout(client, CONNECTION_TIMEOUT);

    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date();
      since.setDate(since.getDate() - 1);

      // Buscar TODOS los emails de los últimos 24h del remitente
      let search = await client.search({ from: senders[0], since });
      if (search.length === 0 && senders.length > 1) {
        const altSearch = await client.search({ from: senders[1], since });
        if (altSearch.length > 0) {
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

        if (!msg?.source) continue;

        const parsed = await simpleParser(msg.source);
        const asunto = parsed.subject || '(sin asunto)';

        // Si hay patrón de asunto para este caso, verificar que coincida
        if (subjectPattern) {
          if (parsed.subject && subjectPattern.test(parsed.subject)) {
            console.error(`[imap] Asunto COINCIDE con "${caso}": "${asunto}"`);
          } else {
            console.error(`[imap] Asunto NO coincide con "${caso}": "${asunto}"`);
            continue;
          }
        }

        const body = parsed.text || parsed.html || '';
        if (!body) continue;

        const codigo = await extractCodeFromBody(body, caso);
        if (!codigo) continue;

        return {
          codigo,
          fecha: parsed.date?.toISOString() || new Date().toISOString(),
          remitente: parsed.from?.text || senders[0],
          asunto: parsed.subject || '',
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
