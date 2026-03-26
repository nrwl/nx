/**
 * ESM resolve hook for tsconfig path aliases.
 * Registered via module.register() when using Node's native TypeScript support.
 *
 * tsconfig-paths only patches CJS Module._resolveFilename. When Node loads
 * a .ts file as ESM, import specifiers bypass that patch — this hook fills the gap.
 */

import { join } from 'path';
import { existsSync } from 'fs';
import { pathToFileURL } from 'url';

const EXTENSIONS = ['', '.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js'];

let patterns;
const resolveCache = new Map();

export function initialize(data) {
  if (data?.baseUrl && data?.paths) {
    const { baseUrl, paths } = data;
    patterns = Object.entries(paths).map(([pattern, mappings]) => {
      const prefix = pattern.replace(/\*$/, '');
      return {
        prefix,
        exactMatch: prefix.replace(/\/$/, ''),
        mappings,
        baseUrl,
      };
    });
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (!patterns) return nextResolve(specifier, context);

  const cached = resolveCache.get(specifier);
  if (cached !== undefined) {
    return cached === null
      ? nextResolve(specifier, context)
      : { shortCircuit: true, url: cached };
  }

  for (const { prefix, exactMatch, mappings, baseUrl } of patterns) {
    if (specifier !== exactMatch && !specifier.startsWith(prefix)) continue;

    const suffix = specifier.slice(prefix.length);
    for (const mapping of mappings) {
      const resolved = mapping.replace(/\*$/, '') + suffix;
      const fullPath = join(baseUrl, resolved);
      for (const ext of EXTENSIONS) {
        if (existsSync(fullPath + ext)) {
          const url = pathToFileURL(fullPath + ext).href;
          resolveCache.set(specifier, url);
          return { shortCircuit: true, url };
        }
      }
    }
  }

  resolveCache.set(specifier, null);
  return nextResolve(specifier, context);
}
