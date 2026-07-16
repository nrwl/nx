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
   * The decoded sourcemap as a JSON string, validated to be a raw v3
   * sourcemap. Rspack's loader callback accepts string maps directly, so
   * keeping it serialized avoids exposing a typed map object (and the casts
   * that would require) at the loader boundary; Rspack parses it itself.
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
  if (!isRawSourceMap(map)) {
    // If the embedded payload is not a sourcemap, pass the code through
    // untouched rather than failing the build over it.
    return { code, map: undefined };
  }

  return { code: code.slice(0, match.index), map };
}

/**
 * Validate that a decoded payload is a raw v3 sourcemap. Rspack fails the
 * module build when the loader callback receives any other JSON value
 * (`{}`, `null`, arrays, ...), so only payloads carrying the required v3
 * fields are forwarded. This matters particularly for the partial-transform
 * loader, which preserves input from arbitrary Angular-related JavaScript.
 */
function isRawSourceMap(json: string): boolean {
  try {
    const parsed: unknown = JSON.parse(json);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      (parsed as { version?: unknown }).version === 3 &&
      typeof (parsed as { mappings?: unknown }).mappings === 'string' &&
      Array.isArray((parsed as { sources?: unknown }).sources)
    );
  } catch {
    return false;
  }
}

// In watch mode the loaders re-read unchanged entries from the shared
// typescript file cache on every rebuild, so memoize the extraction per cache
// key to run the regex + base64 decode + JSON validation once per emitted
// content instead of once per read. The `===` guard on the cached value keeps
// the memo in sync with the file cache: reads of the same instance
// short-circuit on reference equality, while a re-emit with changed contents
// fails the comparison (strings compare by value, `Uint8Array` by reference)
// and recomputes.
const extractionCache = new Map<
  string,
  { source: string | Uint8Array; result: ExtractedSourceMap }
>();

/**
 * Release all memoized extraction results. Called on compiler shutdown so a
 * long-lived process does not retain code/map strings for files deleted or
 * renamed during a watch session. (During the session the memo intentionally
 * mirrors the lifetime of the typescript file cache it shadows, which keeps
 * such entries too.)
 */
export function clearExtractionCache(): void {
  extractionCache.clear();
}

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
