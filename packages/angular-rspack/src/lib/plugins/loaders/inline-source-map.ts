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
 * module build when the loader callback receives anything its deserializer
 * rejects — not just non-objects (`{}`, `null`, arrays, ...) but also
 * well-shaped maps with wrongly typed fields (e.g. `sources: [42]` fails
 * with `bad json: ExpectedString`) — so every field rspack reads is
 * type-checked, including array elements. This matters particularly for the
 * partial-transform loader, which preserves input from arbitrary
 * Angular-related JavaScript. Optional fields may be `null`: rspack's
 * deserializer treats a JSON `null` like an absent optional field.
 */
function isRawSourceMap(json: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return false;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return false;
  }

  const map = parsed as Record<string, unknown>;
  const isString = (value: unknown) => typeof value === 'string';
  const isOptional = (value: unknown, check: (el: unknown) => boolean) =>
    value === undefined || value === null || check(value);
  const isArrayOf = (value: unknown, check: (el: unknown) => boolean) =>
    Array.isArray(value) && value.every(check);

  return (
    map.version === 3 &&
    typeof map.mappings === 'string' &&
    isArrayOf(map.sources, isString) &&
    isOptional(map.names, (v) => isArrayOf(v, isString)) &&
    isOptional(map.sourcesContent, (v) =>
      isArrayOf(v, (el) => el === null || isString(el))
    ) &&
    isOptional(map.file, isString) &&
    isOptional(map.sourceRoot, isString) &&
    isOptional(map.debugId, isString) &&
    isOptional(map.ignoreList, (v) =>
      isArrayOf(v, (el) => typeof el === 'number')
    )
  );
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
