const INLINE_SOURCE_MAP_REGEX =
  /\n?\/\/# sourceMappingURL=data:application\/json[^,]*;base64,([A-Za-z0-9+/=]+)\s*$/;

/**
 * Splits an inline sourcemap comment off the given code so it can be passed
 * to the loader callback and chained into the final sourcemaps, mirroring how
 * the esbuild pipeline consumes the Angular compilation's inline sourcemaps.
 */
export function extractInlineSourceMap(
  code: string
): [code: string, map: string | undefined] {
  const match = code.match(INLINE_SOURCE_MAP_REGEX);
  if (match?.index === undefined) {
    return [code, undefined];
  }
  const map = Buffer.from(match[1], 'base64').toString();
  try {
    JSON.parse(map);
  } catch {
    // A malformed map is unusable; still strip its comment from the code.
    return [code.slice(0, match.index), undefined];
  }
  return [code.slice(0, match.index), map];
}
