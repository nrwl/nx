/**
 * A trailing inline sourcemap comment as produced by `tsc`'s `inlineSourceMap`
 * and by Angular's `JavaScriptTransformer` (babel with `sourceMaps: 'inline'`),
 * e.g. `//# sourceMappingURL=data:application/json;charset=utf-8;base64,<data>`.
 */
const INLINE_SOURCE_MAP_REGEX =
  /\n?\/\/# sourceMappingURL=data:application\/json;(?:charset=[^;,]+;)?base64,([a-zA-Z0-9+/=]+)[ \t]*\r?\n?$/;

export interface ExtractedSourceMap {
  code: string;
  map: Record<string, unknown> | undefined;
}

/**
 * Extract a trailing inline sourcemap from transformed code so it can be handed
 * to Rspack's loader callback as a proper source map.
 *
 * Rspack, unlike esbuild, does not automatically consume inline
 * `//# sourceMappingURL=data:...` comments emitted by a loader. Passing the
 * parsed map as the loader's third callback argument lets Rspack chain it, so
 * the bundled sourcemaps point back to the original TypeScript instead of the
 * intermediate Ivy JavaScript. The comment is stripped from the returned code
 * to avoid the map being duplicated in the module source.
 */
export function extractInlineSourceMap(code: string): ExtractedSourceMap {
  const match = code.match(INLINE_SOURCE_MAP_REGEX);
  if (!match || match.index === undefined) {
    return { code, map: undefined };
  }

  try {
    const map = JSON.parse(
      Buffer.from(match[1], 'base64').toString('utf-8')
    ) as Record<string, unknown>;

    return { code: code.slice(0, match.index), map };
  } catch {
    // If the embedded map cannot be parsed, pass the code through untouched
    // rather than failing the build over a malformed sourcemap.
    return { code, map: undefined };
  }
}
