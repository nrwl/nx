/**
 * Shape-interned string table for IPC payloads whose containers carry many
 * repeated strings, such as per-task hash details. Keys and values become
 * integer refs; each object's key list is interned once as a shape; decode
 * rebuilds plain objects in the original property order.
 *
 * `encodeAuto` decides for itself. The tree format costs a fixed amount per
 * object or array, so it pays only when refs per container is high. The walk
 * checks that ratio every CHECK containers and bails before the tree grows,
 * and it bails on any non-plain object so Dates, Buffers and class instances
 * keep the existing path. Matches JSON on `undefined`; ignores `toJSON`.
 */
const CHECK = 4096;
const MIN_DENSITY = 16;
const MIN_REFS = 2048;

export const DEDUPE_MARKER = '__nx_dedupe__';

export interface DedupedPayload {
  [DEDUPE_MARKER]: 1;
  strings: string[];
  shapes: number[][];
  tree: unknown;
}

class Bail extends Error {}

export function encodeAuto(root: unknown): DedupedPayload | undefined {
  const strings: string[] = [];
  const sindex = new Map<string, number>();
  const shapes: number[][] = [];
  const shapeKeys: string[][] = [];
  const cand = new Map<string, number[]>();
  let refs = 0;
  let containers = 0;
  let nextCheck = CHECK;

  const ref = (s: string): number => {
    refs++;
    let i = sindex.get(s);
    if (i === undefined) {
      i = strings.length;
      strings.push(s);
      sindex.set(s, i);
    }
    return i;
  };
  const container = () => {
    if (++containers === nextCheck) {
      if (refs / containers < MIN_DENSITY) throw new Bail();
      nextCheck += CHECK;
    }
  };
  const shapeOf = (keys: string[]): number => {
    const ck = keys.length ? keys[0] + '\0' + keys.length : '';
    let list = cand.get(ck);
    if (list) {
      for (const id of list) {
        const k = shapeKeys[id];
        let eq = true;
        for (let i = 0; i < keys.length; i++) {
          if (k[i] !== keys[i]) {
            eq = false;
            break;
          }
        }
        if (eq) return id;
      }
    } else {
      list = [];
      cand.set(ck, list);
    }
    const id = shapes.length;
    shapes.push(keys.map(ref));
    shapeKeys.push(keys);
    list.push(id);
    return id;
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return ref(v);
    if (v === null || typeof v !== 'object')
      return [v === undefined ? null : v];
    if (Array.isArray(v)) {
      container();
      return { a: v.map((x) => walk(x === undefined ? null : x)) };
    }
    const proto = Object.getPrototypeOf(v);
    if (
      (proto !== Object.prototype && proto !== null) ||
      typeof (v as any).toJSON === 'function'
    ) {
      throw new Bail();
    }
    container();
    const keys: string[] = [];
    const vals: unknown[] = [];
    for (const key of Object.keys(v)) {
      const x = (v as Record<string, unknown>)[key];
      if (x === undefined) continue;
      keys.push(key);
      vals.push(typeof x === 'string' ? ref(x) : walk(x));
    }
    return { s: shapeOf(keys), v: vals };
  };

  try {
    const tree = walk(root);
    if (refs < MIN_REFS || refs / containers < MIN_DENSITY) return undefined;
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
  const walk = (n: any): unknown => {
    if (typeof n === 'number') return strings[n];
    if (Array.isArray(n)) return n[0];
    if (n.a) return n.a.map(walk);
    const keys = names[n.s];
    const vals = n.v;
    // Large objects go straight to dictionary mode instead of walking hidden
    // class transitions on the way there.
    const big = keys.length > 64;
    const o: Record<string, unknown> = big ? Object.create(null) : {};
    for (let i = 0; i < keys.length; i++) {
      const x = vals[i];
      o[keys[i]] = typeof x === 'number' ? strings[x] : walk(x);
    }
    if (big) Object.setPrototypeOf(o, Object.prototype);
    return o;
  };
  return walk(tree) as T;
}
