/**
 * Shape-interned string table for IPC payloads whose containers carry many
 * repeated strings, such as per-task hash details. Keys and values become
 * integer refs; each object's key list is interned once as a shape; decode
 * rebuilds plain objects in the original property order.
 *
 * `encodeAuto` decides for itself. The tree format costs a fixed amount per
 * object or array and an entry per distinct string, so it pays only when refs
 * per container is high and most refs repeat. Both are checked at the first
 * CONTAINER_CHECK containers and then every CHECK; repetition is checked again
 * at REF_CHECK refs, late because one task's inputs are all distinct until the
 * next task repeats them, and a map wider than that bails before its values
 * are walked. A payload that bails has paid the walk up to the check that
 * failed it. The checks err toward bailing: a payload that is sparse first
 * and dense later keeps the plain path.
 *
 * It also bails on non-plain objects, `toJSON` and depth past MAX_DEPTH, so
 * Dates, Buffers, class instances and cycles keep the existing path. Scalars
 * follow JSON except for BigInt, which JSON rejects and this keeps for v8:
 * `undefined`, functions and symbols are dropped as object values and become
 * null in arrays, as do array holes; NaN and the infinities become null; -0
 * becomes 0.
 */
const CHECK = 4096;
const CONTAINER_CHECK = 512;
const REF_CHECK = 1 << 18;
const MIN_DENSITY = 16;
const MIN_REFS = 2048;
const MAX_DEPTH = 512;

export const DEDUPE_MARKER = '__nx_dedupe__';

export interface DedupedPayload {
  [DEDUPE_MARKER]: 1;
  strings: string[];
  shapes: number[][];
  tree: unknown;
}

class Bail extends Error {}

/** Bucket hash for a shape: its key count folded with each key's ref id. */
export function shapeHash(ids: readonly number[], length = ids.length): number {
  let h = length;
  for (let i = 0; i < length; i++) h = (Math.imul(h, 0x9e3779b1) ^ ids[i]) | 0;
  return h;
}

export function encodeAuto(root: unknown): DedupedPayload | undefined {
  const strings: string[] = [];
  const sindex = new Map<string, number>();
  const shapes: number[][] = [];
  const cand = new Map<number, number[]>();
  let refs = 0;
  let containers = 0;
  let nextCheck = CONTAINER_CHECK;
  let nextRefCheck = REF_CHECK;
  let depth = 0;

  const repeating = () => strings.length * 2 <= refs;
  const ref = (s: string): number => {
    if (++refs === nextRefCheck) {
      if (!repeating()) throw new Bail();
      nextRefCheck += CHECK;
    }
    let i = sindex.get(s);
    if (i === undefined) {
      i = strings.length;
      strings.push(s);
      sindex.set(s, i);
    }
    return i;
  };
  const container = () => {
    if (++depth > MAX_DEPTH) throw new Bail();
    if (++containers === nextCheck) {
      if (refs / containers < MIN_DENSITY || !repeating()) throw new Bail();
      nextCheck += CHECK;
    }
  };
  const dropped = (x: unknown): boolean =>
    x === undefined || typeof x === 'function' || typeof x === 'symbol';
  // Shapes are bucketed by a hash over every key's ref, so an object whose
  // keys are all known costs one map lookup per key, and the element-wise
  // compare runs only within a bucket. A key not yet in the table cannot
  // belong to any existing shape, so that object starts a new one directly.
  const ids: number[] = [];
  const shapeOf = (keys: string[]): number => {
    for (let i = 0; i < keys.length; i++) {
      const id = sindex.get(keys[i]);
      if (id === undefined) return newShape(keys);
      ids[i] = id;
    }
    const h = shapeHash(ids, keys.length);
    const list = cand.get(h);
    if (list) {
      for (const sid of list) {
        const shape = shapes[sid];
        // A shared bucket does not imply equal length; without this a list
        // would match a longer shape it is a prefix of.
        if (shape.length !== keys.length) continue;
        let eq = true;
        for (let i = 0; i < keys.length; i++) {
          if (shape[i] !== ids[i]) {
            eq = false;
            break;
          }
        }
        if (eq) return sid;
      }
    }
    return newShape(keys, h);
  };
  const newShape = (keys: string[], h = -1): number => {
    const shape = keys.map(ref);
    if (h === -1) h = shapeHash(shape);
    const id = shapes.length;
    shapes.push(shape);
    const list = cand.get(h);
    if (list) list.push(id);
    else cand.set(h, [id]);
    return id;
  };

  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return ref(v);
    if (dropped(v)) throw new Bail();
    if (typeof v === 'number') {
      return [Number.isFinite(v) ? (v === 0 ? 0 : v) : null];
    }
    if (v === null || typeof v !== 'object') return [v];
    if (Array.isArray(v)) {
      container();
      const a: unknown[] = new Array(v.length);
      for (let i = 0; i < v.length; i++) {
        const x = v[i];
        a[i] = dropped(x) ? [null] : walk(x);
      }
      depth--;
      return { a };
    }
    const proto = Object.getPrototypeOf(v);
    if (
      (proto !== Object.prototype && proto !== null) ||
      typeof (v as any).toJSON === 'function'
    ) {
      throw new Bail();
    }
    container();
    const own = Object.keys(v);
    // Keys are refs only once the object is walked, so a map wider than the
    // ref check would be walked in full before that check could fail it.
    if (own.length > REF_CHECK) throw new Bail();
    const keys: string[] = [];
    const vals: unknown[] = [];
    for (const key of own) {
      const x = (v as Record<string, unknown>)[key];
      if (dropped(x)) continue;
      keys.push(key);
      vals.push(typeof x === 'string' ? ref(x) : walk(x));
    }
    depth--;
    return { s: shapeOf(keys), v: vals };
  };

  try {
    const tree = walk(root);
    if (refs < MIN_REFS || refs / containers < MIN_DENSITY || !repeating()) {
      return undefined;
    }
    return { [DEDUPE_MARKER]: 1, strings, shapes, tree };
  } catch (e) {
    if (e instanceof Bail) return undefined;
    throw e;
  }
}

export function isDedupedPayload(value: unknown): value is DedupedPayload {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as any)[DEDUPE_MARKER] === 1 &&
    Array.isArray((value as any).strings)
  );
}

export function decodeDeduped<T = unknown>({
  strings,
  shapes,
  tree,
}: DedupedPayload): T {
  const names = shapes.map((sh) => sh.map((i) => strings[i]));
  // Large objects go straight to dictionary mode instead of walking hidden
  // class transitions on the way there. A `__proto__` key needs the same
  // null prototype so assignment defines it instead of hitting the setter.
  const detached = names.map(
    (keys) => keys.length > 64 || keys.includes('__proto__')
  );
  const walk = (n: any): unknown => {
    if (typeof n === 'number') return strings[n];
    if (Array.isArray(n)) return n[0];
    if (n.a) return n.a.map(walk);
    const keys = names[n.s];
    const vals = n.v;
    const o: Record<string, unknown> = detached[n.s] ? Object.create(null) : {};
    for (let i = 0; i < keys.length; i++) {
      const x = vals[i];
      o[keys[i]] = typeof x === 'number' ? strings[x] : walk(x);
    }
    if (detached[n.s]) Object.setPrototypeOf(o, Object.prototype);
    return o;
  };
  return walk(tree) as T;
}
