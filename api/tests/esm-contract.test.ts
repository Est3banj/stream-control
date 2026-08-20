/**
 * Test de CONTRATO del runtime ESM de firebase-admin (bug de producción real):
 * con `import * as admin`, el namespace sintético de node NO expone firestore/apps
 * (undefined en runtime — verificado con node puro) aunque TSC los declare.
 * El código DEBE usar import default. Vitest (vite-node) NO replica el namespace
 * de node, así que este test solo fija el contrato del default import (lo que usamos).
 */
import { describe, expect, it } from 'vitest';

describe('ESM contract de firebase-admin (bug namespace sintético)', () => {
  it('import default DEBE exponer firestore, apps, credential y FieldValue', async () => {
    const mod = await import('firebase-admin');
    const admin = (mod as { default: Record<string, unknown> }).default;
    expect(typeof admin.firestore).toBe('function');
    expect(Array.isArray(admin.apps)).toBe(true);
    expect(typeof admin.credential).toBe('object');
    const fv = (admin.firestore as { FieldValue?: Record<string, unknown> }).FieldValue;
    expect(typeof fv?.serverTimestamp).toBe('function');
    expect(typeof fv?.delete).toBe('function');
    expect(typeof fv?.increment).toBe('function');
  });
});