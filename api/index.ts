/**
 * Entry de Vercel: default export = catch-all /api/**
 * (@vercel/node transpila TS nativamente; ver vercel.json en el root)
 */

import { createApp } from './src/app.js';

export default createApp();