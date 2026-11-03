import { readdirSync, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

/** The document server rendering renders into, in the server output. */
export const INDEX_SERVER_HTML = 'index.server.html';
/** The document served for client-rendered routes, in the server output. */
export const INDEX_CSR_HTML = 'index.csr.html';
/**
 * The app manifest's critical CSS fields for `@angular/ssr` >= 22.2, in the
 * server output.
 */
export const CRITICAL_CSS_FILE = 'critical-css.json';

interface ServerAsset {
  text: () => Promise<string>;
}

/**
 * Builds the `assets` table of the Angular app manifest from the build
 * output. The esbuild application builder inlines these assets into the
 * server output at build time; here only directory listings and file stats
 * are read when the server process starts and contents are read lazily, so a
 * restarted process always serves the current build output and rebuilds never
 * have to invalidate the SSR entry module (whose injected code would
 * otherwise embed stale index contents under output hashing).
 *
 * The index documents come from the server output. Top-level stylesheets of
 * the browser output are included only when `inlineCriticalCss` is set: the
 * inliner of `@angular/ssr` < 22.2, which fetches them by file name, is their
 * only consumer.
 *
 * This module is bundled into the user's server bundle, so it must only
 * import node builtins.
 */
export function createServerAssets(
  serverOutputPath: string,
  browserOutputPath: string,
  inlineCriticalCss: boolean
): Record<string, ServerAsset> {
  const assets: Record<string, ServerAsset> = {};
  if (inlineCriticalCss) {
    let entries: string[] = [];
    try {
      entries = readdirSync(browserOutputPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // Without a browser output there is nothing to inline.
    }
    for (const entry of entries) {
      if (extname(entry) === '.css') {
        const asset = createDiskAsset(join(browserOutputPath, entry));
        if (asset) {
          assets[entry] = asset;
        }
      }
    }
  }
  for (const name of [INDEX_SERVER_HTML, INDEX_CSR_HTML]) {
    const asset = createDiskAsset(join(serverOutputPath, name));
    if (asset) {
      assets[name] = asset;
    }
  }
  return assets;
}

/**
 * Reads the `criticalCssPlans` and `nonce` app manifest fields, which
 * `@angular/ssr` >= 22.2 inlines critical CSS with.
 */
export function readCriticalCss(serverOutputPath: string): {
  criticalCssPlans?: unknown[];
  nonce?: string;
} {
  let content: string;
  try {
    content = readFileSync(join(serverOutputPath, CRITICAL_CSS_FILE), 'utf-8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    // Never emitted, as when the browser build failed; rendering then skips
    // critical CSS inlining.
    return {};
  }
  return JSON.parse(content);
}

function createDiskAsset(filePath: string): ServerAsset | undefined {
  try {
    statSync(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    // Never emitted under this name, or removed by a concurrent rebuild;
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
