import { readJsonFile } from '@nx/devkit';
import { dirname } from 'node:path';

/**
 * Lightweight tsconfig extends walker that does NOT load the `typescript`
 * package. For full TypeScript-aware parsing (compilerOptions resolution,
 * file lists, project references, etc.) see the `@nx/js/typescript` plugin,
 * which uses `ts.parseJsonConfigFileContent` and a persistent cache.
 */

/**
 * Cache of raw parsed tsconfig JSON contents, keyed by absolute file path.
 * `null` indicates a file that doesn't exist or failed to parse.
 *
 * Instantiate with `new Map()` and reuse across `walkTsconfigExtendsChain`
 * calls within one `createNodes` invocation to dedupe file reads when many
 * starting points share parent tsconfigs.
 */
export type RawTsconfigJsonCache = Map<string, unknown | null>;

/**
 * Walks the `extends` chain of a tsconfig, invoking `visit` for each unique
 * reachable file (entry first, then recursively). Cycle-safe. Files that
 * don't exist or fail to parse are silently skipped.
 *
 * When a tsconfig has multiple `extends` entries they are visited in
 * REVERSE order, so visitors looking for the effective value of an
 * inherited option see the highest-precedence entries first and can
 * return `'stop'` to abort the traversal. Visitors that want to collect
 * every reachable file should always return `'continue'`.
 *
 * @param entryAbsolutePath Absolute, canonical path of the tsconfig to
 *   start from. Pass through `path.resolve()` if unsure.
 * @param visit Invoked once per unique reachable tsconfig.
 * @param options.jsonCache Optional shared cache of parsed tsconfig
 *   contents. When omitted, the walker uses a fresh internal cache.
 */
export function walkTsconfigExtendsChain(
  entryAbsolutePath: string,
  visit: (absolutePath: string, rawJson: unknown) => 'continue' | 'stop',
  options?: { jsonCache?: RawTsconfigJsonCache }
): void {
  const jsonCache: RawTsconfigJsonCache = options?.jsonCache ?? new Map();
  walk(entryAbsolutePath, visit, jsonCache, new Set());
}

function walk(
  absolutePath: string,
  visit: (absolutePath: string, rawJson: unknown) => 'continue' | 'stop',
  jsonCache: RawTsconfigJsonCache,
  visited: Set<string>
): 'continue' | 'stop' {
  if (visited.has(absolutePath)) return 'continue';
  visited.add(absolutePath);

  const json = readCachedJson(absolutePath, jsonCache);
  if (json === null) return 'continue';

  if (visit(absolutePath, json) === 'stop') return 'stop';

  const extendsField = (json as { extends?: unknown }).extends;
  if (!extendsField) return 'continue';
  const extendsList = Array.isArray(extendsField)
    ? extendsField
    : [extendsField];

  // Last entry wins per TypeScript precedence; walk in reverse so
  // precedence-aware visitors see the highest-precedence entries first.
  const fromDir = dirname(absolutePath);
  for (let i = extendsList.length - 1; i >= 0; i--) {
    const ext = extendsList[i];
    if (typeof ext !== 'string' || !ext) continue;
    const childPath = resolveExtendsPath(ext, fromDir);
    if (childPath === null) continue;
    if (walk(childPath, visit, jsonCache, visited) === 'stop') return 'stop';
  }

  return 'continue';
}

function readCachedJson(
  absolutePath: string,
  cache: RawTsconfigJsonCache
): unknown | null {
  if (cache.has(absolutePath)) {
    return cache.get(absolutePath) ?? null;
  }
  let parsed: unknown | null;
  try {
    parsed = readJsonFile(absolutePath);
  } catch {
    parsed = null;
  }
  cache.set(absolutePath, parsed);
  return parsed;
}

function resolveExtendsPath(
  extendsValue: string,
  fromDir: string
): string | null {
  try {
    return require.resolve(extendsValue, { paths: [fromDir] });
  } catch {
    return null;
  }
}
