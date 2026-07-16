/**
 * A trailing inline sourcemap comment as produced by `tsc`'s `inlineSourceMap`
 * and by Angular's `JavaScriptTransformer` (babel with `sourceMaps: 'inline'`),
 * e.g. `//# sourceMappingURL=data:application/json;charset=utf-8;base64,<data>`.
 */
// The optional leading `\r?\n` consumes the newline (including CRLF) that
// precedes the comment so no stray `\r` is left on the returned code, and the
// trailing `\s*` tolerates any amount of trailing whitespace/newlines.
const INLINE_SOURCE_MAP_REGEX =
  /(?:\r?\n)?\/\/# sourceMappingURL=data:application\/json;(?:charset=[^;,]+;)?base64,([a-zA-Z0-9+/=]+)\s*$/;

export interface ExtractedSourceMap {
  code: string;
  /**
   * The decoded sourcemap as a JSON string, validated to parse. Rspack's
   * loader callback accepts string maps directly, so keeping it serialized
   * avoids a JSON.parse/typing round-trip in the loaders.
   */
  map: string | undefined;
}

/**
 * Extract a trailing inline sourcemap from transformed code so it can be handed
 * to Rspack's loader callback as a proper source map.
 *
 * Rspack, unlike esbuild, does not automatically consume inline
 * `//# sourceMappingURL=data:...` comments emitted by a loader. Passing the
 * map as the loader's third callback argument lets Rspack chain it, so the
 * bundled sourcemaps point back to the original TypeScript instead of the
 * intermediate Ivy JavaScript. The comment is stripped from the returned code
 * to avoid the map being duplicated in the module source.
 */
export function extractInlineSourceMap(code: string): ExtractedSourceMap {
  const match = code.match(INLINE_SOURCE_MAP_REGEX);
  if (!match || match.index === undefined) {
    return { code, map: undefined };
  }

  const map = Buffer.from(match[1], 'base64').toString('utf-8');
  try {
    JSON.parse(map);
  } catch {
    // If the embedded map cannot be parsed, pass the code through untouched
    // rather than failing the build over a malformed sourcemap.
    return { code, map: undefined };
  }

  return { code: code.slice(0, match.index), map };
}

// In watch mode the loaders re-read unchanged entries from the shared
// typescript file cache on every rebuild, so memoize the extraction per cache
// key to run the regex + base64 decode + JSON validation once per emitted
// content instead of once per read. A re-emit stores a new string/buffer
// instance in the file cache, so the identity check on the cached value
// invalidates stale memo entries.
const extractionCache = new Map<
  string,
  { source: string | Uint8Array; result: ExtractedSourceMap }
>();

/**
 * Memoized variant of {@link extractInlineSourceMap} for contents read from
 * the typescript file cache, keyed by the cache key (the file's request path).
 */
export function extractInlineSourceMapCached(
  key: string,
  contents: string | Uint8Array
): ExtractedSourceMap {
  const cached = extractionCache.get(key);
  if (cached && cached.source === contents) {
    return cached.result;
  }

  const code =
    typeof contents === 'string'
      ? contents
      : Buffer.from(contents).toString('utf-8');
  const result = extractInlineSourceMap(code);
  extractionCache.set(key, { source: contents, result });
  return result;
}
