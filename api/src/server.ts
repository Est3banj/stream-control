/**
 * Servidor de desarrollo local (no se usa en Vercel).
 * Inicia la app Express en el puerto configurado (default 3001) para el proxy del frontend.
 */

import { createApp } from './app.js';

const port = Number(process.env.PORT || 3001);
createApp().listen(port, () => {
  console.log(`🚀 API Express escuchando en http://localhost:${port}`);
});