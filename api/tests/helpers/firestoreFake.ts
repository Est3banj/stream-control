/**
 * Firestore fake para tests de contrato (AD-9): colecciones en memoria,
 * transacciones SERIALIZADAS (cola interna → deterministas bajo Promise.all),
 * batch, FieldValue sentinels, queries con filtros comunes (==, <, <=, >, >=, in, !=).
 *
 * Se inyecta vía vi.mock('../src/firebase').
 */

type DocData = Record<string, unknown>;

class FieldValueFake {
  static serverTimestamp(): unknown {
    return { __op: 'serverTimestamp' };
  }
  static increment(n: number): unknown {
    return { __op: 'increment', value: n };
  }
  static delete(): unknown {
    return { __op: 'delete' };
  }
}

class TimestampFake {
  constructor(private readonly _ms: number) {}
  toMillis(): number {
    return this._ms;
  }
  toDate(): Date {
    return new Date(this._ms);
  }
  static now(): TimestampFake {
    return new TimestampFake(Date.now());
  }
  static fromDate(d: Date): TimestampFake {
    return new TimestampFake(d.getTime());
  }
}

type Ref = {
  readonly col: string;
  readonly id: string;
  get(): Promise<Ref & { exists: boolean; data(): DocData }>;
  update(patch: DocData): Promise<void>;
  set(data: DocData, opts?: { merge?: boolean }): Promise<void>;
  delete(): Promise<void>;
};

class Store {
  readonly docs = new Map<string, Map<string, DocData>>();

  ref(col: string, id: string): Ref {
    return {
      col,
      id,
      get: async () => {
        const data = this.get(col, id);
        return {
          col,
          id,
          ref: this.ref(col, id),
          exists: data !== undefined,
          data: () => data,
          get: () => Promise.resolve(this.ref(col, id).get()),
          update: (p: DocData) => this.update(col, id, p),
          set: (d: DocData, o?: { merge?: boolean }) => this.set(col, id, d, o),
          delete: () => {
            this.delete(col, id);
            return Promise.resolve();
          },
        } as unknown as Ref & { exists: boolean; data(): DocData };
      },
      update: (p: DocData) => this.update(col, id, p),
      set: (d: DocData, o?: { merge?: boolean }) => this.set(col, id, d, o),
      delete: () => {
        this.delete(col, id);
        return Promise.resolve();
      },
    };
  }

  has(col: string, id: string): boolean {
    return this.docs.get(col)?.has(id) ?? false;
  }

  get(col: string, id: string): DocData | undefined {
    return this.docs.get(col)?.get(id);
  }

  set(col: string, id: string, data: DocData, opts?: { merge?: boolean }): Promise<void> {
    if (!this.docs.has(col)) this.docs.set(col, new Map());
    const colDocs = this.docs.get(col)!;
    if (opts?.merge && colDocs.has(id)) {
      const merged = { ...colDocs.get(id) };
      for (const [k, v] of Object.entries(data)) {
        if (isDeleteSentinel(v)) delete merged[k];
        else merged[k] = v;
      }
      colDocs.set(id, merged);
    } else {
      colDocs.set(id, { ...data });
    }
    return Promise.resolve();
  }

  update(col: string, id: string, patch: DocData): Promise<void> {
    if (!this.docs.has(col)) this.docs.set(col, new Map());
    const colDocs = this.docs.get(col)!;
    const existing = { ...(colDocs.get(id) ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (isDeleteSentinel(v)) delete existing[k];
      else if (isIncrementSentinel(v)) existing[k] = ((existing[k] as number) ?? 0) + (v as { value: number }).value;
      else existing[k] = v;
    }
    colDocs.set(id, existing);
    return Promise.resolve();
  }

  delete(col: string, id: string): Promise<void> {
    this.docs.get(col)?.delete(id);
    return Promise.resolve();
  }
}

function isDeleteSentinel(v: unknown): boolean {
  return v !== null && typeof v === 'object' && (v as { __op?: string }).__op === 'delete';
}
function isIncrementSentinel(v: unknown): boolean {
  return v !== null && typeof v === 'object' && (v as { __op?: string }).__op === 'increment';
}

function matches(data: DocData, f: { field: string; op: string; value: unknown }): boolean {
  const actual = data[f.field];
  switch (f.op) {
    case '==': return actual === f.value;
    case '!=': return actual !== f.value;
    case '<': return actual != null && (actual as number) < (f.value as number);
    case '<=': return actual != null && (actual as number) <= (f.value as number);
    case '>': return actual != null && (actual as number) > (f.value as number);
    case '>=': return actual != null && (actual as number) >= (f.value as number);
    case 'in': return Array.isArray(f.value) && f.value.includes(actual);
    default: return true;
  }
}

export function createFirestoreFake() {
  const store = new Store();
  const transactionLog: Array<{ reads: string[]; writes: string[] }> = [];
  let txQueue = Promise.resolve();

  // IMPORTANTE: reset() limpia el store SIN reemplazar el objeto `db` —
  // los src/* capturan `const db = getDb()` en module scope; reemplazar el
  // objeto los dejaría apuntando a un fake zombie.
  const clear = () => {
    store.docs.clear();
    transactionLog.length = 0;
    txQueue = Promise.resolve();
  };

  const db = {
    FieldValue: FieldValueFake,
    Timestamp: TimestampFake,
    collection(col: string) {
      return {
        doc(id?: string): Ref {
          return id === undefined ? store.ref(col, `auto_${Math.random().toString(36).slice(2, 10)}`) : store.ref(col, id);
        },
        where(field: string, op: string, value: unknown) {
          return { ...this, _filters: [{ field, op, value }] };
        },
        add(data: DocData): Promise<Ref & { id: string }> {
          const id = `auto_${Math.random().toString(36).slice(2, 10)}`;
          const r = store.ref(col, id);
          return store.set(col, id, data).then(() => ({ ...r, id } as Ref & { id: string }));
        },
        orderBy() {
          return this;
        },
        limit(n: number) {
          return { ...this, _limit: n };
        },
        get(): Promise<{ docs: Array<{ id: string; ref: Ref; exists: boolean; data(): DocData }>; empty: boolean; size: number }> {
          const filters = ((this as unknown as { _filters?: unknown })._filters ?? []) as Array<{ field: string; op: string; value: unknown }>;
          const lim = (this as unknown as { _limit?: number })._limit;
          const allIds = Array.from(store.docs.get(col) ?? new Map(), ([id]) => id);
          const ids = allIds.filter(id => filters.every(f => matches(store.get(col, id) ?? {}, f)));
          const limited = lim != null ? ids.slice(0, lim) : ids;
          const docs = limited.map((id) => {
            const ref = store.ref(col, id);
            return {
              id,
              ref,
              exists: true,
              data: () => store.get(col, id) as DocData,
            };
          });
          const empty = docs.length === 0;
          return Promise.resolve({ docs, empty, size: docs.length });
        },
      };
    },
    batch() {
      const ops: Array<() => Promise<void>> = [];
      return {
        set(ref: Ref, data: DocData) {
          ops.push(() => ref.set(data));
        },
        update(ref: Ref, patch: DocData) {
          ops.push(() => ref.update(patch));
        },
        delete(ref: Ref) {
          ops.push(() => ref.delete());
        },
        async commit() {
          for (const op of ops) await op();
        },
      };
    },
    runTransaction<T>(fn: (tx: {
      get(ref: Ref): Promise<Ref & { exists: boolean; data(): DocData }>;
      set(ref: Ref, data: DocData): void;
      update(ref: Ref, patch: DocData): void;
      delete(ref: Ref): void;
    }) => Promise<T>): Promise<T> {
      const run = async (): Promise<T> => {
        const reads: string[] = [];
        const writes: string[] = [];
        const tx = {
          get: async (ref: Ref) => {
            reads.push(`${ref.col}/${ref.id}`);
            return ref.get();
          },
          set: (ref: Ref, data: DocData) => {
            writes.push(`set:${ref.col}/${ref.id}`);
            void ref.set(data);
          },
          update: (ref: Ref, patch: DocData) => {
            writes.push(`update:${ref.col}/${ref.id}`);
            void ref.update(patch);
          },
          delete: (ref: Ref) => {
            writes.push(`delete:${ref.col}/${ref.id}`);
            void ref.delete();
          },
        };
        const result = await fn(tx);
        transactionLog.push({ reads, writes });
        return result;
      };
      const result = txQueue.then(run);
      txQueue = result.then(() => undefined, () => undefined);
      return result;
    },
  };

  return {
    db,
    clear,
    transactionLog,
    seed(col: string, id: string, data: DocData) {
      store.set(col, id, data);
      return db.collection(col).doc(id);
    },
    getData(col: string, id: string): DocData | undefined {
      return store.get(col, id);
    },
    getCollection(col: string): Array<[string, DocData]> {
      return Array.from(store.docs.get(col) ?? new Map());
    },
  };
}

export type FirestoreFake = ReturnType<typeof createFirestoreFake>;