import { readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

interface ServerAsset {
  text: () => Promise<string>;
}

/**
 * Builds the `assets` table of the Angular app manifest from the browser
 * output that sits next to the server bundle. The esbuild application
 * builder inlines these assets into the server output at build time; here
 * only the directory listing and file stats are read when the server process
 * starts and contents are read lazily, so a restarted process always serves
 * the current build output and rebuilds never have to invalidate the SSR
 * entry module (whose injected code would otherwise embed stale index
 * contents under output hashing).
 *
 * The table maps the emitted index html to the `index.server.html` and
 * `index.csr.html` names the `@angular/ssr` render path looks up. Top-level
 * stylesheets are included only when critical CSS inlining is enabled: the
 * inliner, which fetches them by file name, is their only consumer.
 *
 * This module is bundled into the user's server bundle, so it must only
 * import node builtins.
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
  if (indexOutputName) {
    const indexAsset = createDiskAsset(
      join(browserOutputPath, indexOutputName)
    );
    if (indexAsset) {
      // Never registered under its emitted name: the engine serves a table
      // hit for a prerender-marked route as-is, so an `index.html` key would
      // serve the un-rendered CSR shell for `/` instead of rendering it.
      assets['index.server.html'] = indexAsset;
      assets['index.csr.html'] = indexAsset;
    }
  }
  return assets;
}

function createDiskAsset(filePath: string): ServerAsset | undefined {
  try {
    statSync(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    // Removed between the listing and the stat by a concurrent rebuild;
    // rendering reports the missing asset.
    return undefined;
  }
  let text: Promise<string> | undefined;
  return {
    // The engine reads assets per request; the output file is immutable for
    // the process lifetime, so cache the content. Only a fulfilled read is
    // kept: a memoized rejection would fail every later request.
    text: () =>
      (text ??= readFile(filePath, 'utf-8').catch((error) => {
        text = undefined;
        throw error;
      })),
  };
}
