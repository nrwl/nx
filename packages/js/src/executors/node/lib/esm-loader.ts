import { pathToFileURL } from 'node:url';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Custom ESM resolver for Node.js that handles Nx workspace library mappings.
 *
 * This resolver is necessary because:
 * 1. Node.js ESM resolution doesn't understand TypeScript path mappings (e.g., @myorg/mylib)
 * 2. Nx workspace libraries need to be resolved to their actual built output locations
 * 3. The built output might be in different formats (.js, .mjs) or locations (index.js)
 *
 * The resolver intercepts import requests for workspace libraries and maps them to their
 * actual file system locations based on the NX_MAPPINGS environment variable set by
 * the Node executor.
 */
export async function resolve(
  specifier: string,
  context: any,
  nextResolve: any
) {
  // Parse mappings on each call to ensure we get the latest values
  const mappings = JSON.parse(process.env.NX_MAPPINGS || '{}');
  const mappingKeys = Object.keys(mappings);

  // Check if this is a workspace library mapping
  const matchingKey = mappingKeys.find(
    (key) => specifier === key || specifier.startsWith(key + '/')
  );

  if (matchingKey) {
    const mappedPath = mappings[matchingKey];
    const restOfPath = specifier.slice(matchingKey.length);
    const fullPath = join(mappedPath, restOfPath);

    // Try to resolve the mapped path as a file first
    if (existsSync(fullPath)) {
      const stats = statSync(fullPath);
      if (stats.isFile()) {
        return nextResolve(pathToFileURL(fullPath).href, context);
      }
    }

    // Try with index.js
    const indexPath = join(fullPath, 'index.js');
    if (existsSync(indexPath)) {
      return nextResolve(pathToFileURL(indexPath).href, context);
    }

    const jsPath = fullPath + '.js';
    if (existsSync(jsPath)) {
      return nextResolve(pathToFileURL(jsPath).href, context);
    }

    const mjsPath = fullPath + '.mjs';
    if (existsSync(mjsPath)) {
      return nextResolve(pathToFileURL(mjsPath).href, context);
    }
  }

  return nextResolve(specifier, context);
}
