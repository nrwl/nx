import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

interface ServerAsset {
  text: () => Promise<string>;
  hash: string;
  size: number;
}

/**
 * Builds the `assets` table of the Angular app manifest from the browser
 * output that sits next to the server bundle. The esbuild application
 * builder inlines these assets into the server output at build time; here
 * they are read from disk when the server process starts, so a restarted
 * process always serves the current build output and rebuilds never have to
 * invalidate the SSR entry module (whose injected code would otherwise
 * embed stale index contents under output hashing).
 *
 * The table maps the emitted index html to the `index.server.html` and
 * `index.csr.html` names the `@angular/ssr` runtime looks up. Top-level
 * stylesheets are included only when critical CSS inlining is enabled: the
 * inliner, which fetches them by file name, is their only consumer.
 */
export function createBrowserOutputServerAssets(
  browserOutputPath: string,
  indexOutputName: string | undefined,
  inlineCriticalCss: boolean
): Record<string, ServerAsset> {
  const assets: Record<string, ServerAsset> = {};
  let entries: string[];
  try {
    entries = readdirSync(browserOutputPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    // Without a browser output there is nothing to serve; rendering reports
    // the missing asset.
    return assets;
  }
  if (inlineCriticalCss) {
    for (const entry of entries) {
      if (extname(entry) === '.css') {
        const asset = createDiskAsset(join(browserOutputPath, entry));
        if (asset) {
          assets[entry] = asset;
        }
      }
    }
  }
  if (indexOutputName && entries.includes(indexOutputName)) {
    const indexAsset = createDiskAsset(
      join(browserOutputPath, indexOutputName)
    );
    if (indexAsset) {
      assets[indexOutputName] = indexAsset;
      assets['index.server.html'] = indexAsset;
      assets['index.csr.html'] = indexAsset;
    }
  }
  return assets;
}

function createDiskAsset(filePath: string): ServerAsset | undefined {
  let size: number;
  try {
    size = statSync(filePath).size;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    // Removed between the listing and the stat by a concurrent rebuild;
    // rendering reports the missing asset.
    return undefined;
  }
  let hash: string | undefined;
  let text: Promise<string> | undefined;
  return {
    size,
    // The hash only backs the engine's ETag handling; any stable
    // content-derived value works.
    get hash(): string {
      hash ??= createHash('sha256')
        .update(readFileSync(filePath))
        .digest('hex');
      return hash;
    },
    // The engine reads assets per request; the output file is immutable for
    // the process lifetime, so cache the content.
    text: () => (text ??= readFile(filePath, 'utf-8')),
  };
}
