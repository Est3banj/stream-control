/**
 * Runner de GH Actions (AD-2): inicializa Admin SDK desde FIREBASE_SERVICE_ACCOUNT
 * y ejecuta el cron de vencimientos. Salida con process.exit para errores visibles.
 *
 * Uso: FIREBASE_SERVICE_ACCOUNT='{json}' TELEGRAM_TOKEN='...' node dist/scripts/cron-vencimientos.js
 */

import { generarNotificacionesVencimientos } from '../src/crons/vencimientos.js';
import { getDb } from '../src/firebase.js';

async function main(): Promise<void> {
  getDb();
  const resumen = await generarNotificacionesVencimientos();
  console.log('Cron vencimientos OK:', JSON.stringify(resumen));
}

main().catch((err) => {
  console.error('Cron vencimientos FAILED:', err);
  process.exit(1);
});