import type { RawSourceMap } from '@rspack/core';

// A `sourceMappingURL` value: an inline base64 data URI (captured) or any
// other reference, e.g. an external `.js.map` file.
const SOURCE_MAP_URL_SOURCE =
  'sourceMappingURL=(?:data:application\\/json[^,]*;base64,([A-Za-z0-9+/=]+)|[^\\r\\n]*?)';

// Matches a trailing sourcemap comment in the forms source-map-loader
// consumes: `//#`, the legacy `//@`, and their single-line block variants
// `/*# ... */` and `/*@ ... */`. The leading `\r?\n` consumes the newline
// preceding the comment so no stray `\r` is left on the stripped code. The
// inline base64 payload lands in group 1 (line comment) or group 2 (block
// comment).
const TRAILING_SOURCE_MAP_COMMENT_REGEX = new RegExp(
  `(?:\\r?\\n)?(?:\\/\\/[#@][ \\t]+${SOURCE_MAP_URL_SOURCE}|\\/\\*[#@][ \\t]+${SOURCE_MAP_URL_SOURCE}[ \\t]*\\*\\/)\\s*$`
);

export interface ExtractedSourceMap {
  code: string;
  /** The decoded sourcemap as a JSON string, when inline and usable. */
  map: string | undefined;
  /**
   * Whether a trailing sourceMappingURL comment was stripped from the code,
   * even when it yielded no usable map (an external file reference or a
   * payload rspack would reject).
   */
  strippedComment: boolean;
}

/**
 * Splits a trailing sourcemap comment off the given code so the map can be
 * passed to the loader callback and chained into the final sourcemaps,
 * mirroring how the esbuild pipeline consumes the inline sourcemaps of the
 * Angular compilation and the JavaScript transformer. Comments that carry no
 * usable inline map are still stripped: esbuild never emits input
 * sourceMappingURL comments into the bundle.
 */
export function extractInlineSourceMap(code: string): ExtractedSourceMap {
  const match = code.match(TRAILING_SOURCE_MAP_COMMENT_REGEX);
  if (match?.index === undefined) {
    return { code, map: undefined, strippedComment: false };
  }
  const stripped = code.slice(0, match.index);
  const inlinePayload = match[1] ?? match[2];
  if (inlinePayload === undefined) {
    // A reference to an external map file; there is nothing to decode.
    return { code: stripped, map: undefined, strippedComment: true };
  }
  const map = Buffer.from(inlinePayload, 'base64').toString('utf8');
  try {
    if (!isForwardableSourceMap(JSON.parse(map))) {
      return { code: stripped, map: undefined, strippedComment: true };
    }
  } catch {
    // A malformed map is unusable; still strip its comment from the code.
    return { code: stripped, map: undefined, strippedComment: true };
  }
  return { code: stripped, map, strippedComment: true };
}

/**
 * Whether rspack's sourcemap deserializer accepts this value as a
 * loader-provided map. Rspack fails the module build on any map it cannot
 * deserialize, even when sourcemaps are disabled, so externally authored maps
 * (a package's own sourcemap) must pass this check before being handed to
 * the loader callback. Mirrors rspack's deserialization rules: `mappings`
 * must be a string; every other field is optional and may be null, but a
 * present value must have the expected type, including array elements
 * (`sources`, `names` and `sourcesContent` entries may be null; `ignoreList`
 * entries are deserialized as unsigned 32-bit integers).
 */
export function isForwardableSourceMap(value: unknown): value is RawSourceMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const map = value as Record<string, unknown>;
  const isNullableString = (v: unknown) => v === null || typeof v === 'string';
  const isOptional = (v: unknown, check: (v: unknown) => boolean) =>
    v === undefined || v === null || check(v);
  const isArrayOf = (v: unknown, check: (v: unknown) => boolean) =>
    Array.isArray(v) && v.every(check);

  return (
    typeof map.mappings === 'string' &&
    isOptional(map.sources, (v) => isArrayOf(v, isNullableString)) &&
    isOptional(map.names, (v) => isArrayOf(v, isNullableString)) &&
    isOptional(map.sourcesContent, (v) => isArrayOf(v, isNullableString)) &&
    isOptional(map.file, (v) => typeof v === 'string') &&
    isOptional(map.sourceRoot, (v) => typeof v === 'string') &&
    isOptional(map.debugId, (v) => typeof v === 'string') &&
    isOptional(map.ignoreList, (v) =>
      isArrayOf(
        v,
        (el) =>
          typeof el === 'number' &&
          Number.isInteger(el) &&
          el >= 0 &&
          el <= 0xffffffff
      )
    )
  );
}
