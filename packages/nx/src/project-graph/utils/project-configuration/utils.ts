import {
  readArrayItemSourceInfo,
  readObjectPropertySourceInfo,
  type SourceInformation,
} from './source-maps';

export const NX_SPREAD_TOKEN = '...';

/**
 * Returns the union of keys across every provided object.
 */
export function uniqueKeysInObjects(
  ...objs: Array<object | null | undefined>
): Set<string> {
  const keys = new Set<string>();
  for (const obj of objs) {
    if (obj) {
      for (const key of Object.keys(obj)) {
        keys.add(key);
      }
    }
  }
  return keys;
}

// Integer-like string keys (`"0"`, `"42"`) are enumerated before
// insertion-order keys, so we can't tell if they were authored before or
// after `'...'`. Spread sites reject them instead of guessing.
export const INTEGER_LIKE_KEY_PATTERN = /^(0|[1-9]\d*)$/;

export class IntegerLikeSpreadKeyError extends Error {
  constructor(key: string, context: string) {
    super(
      `${context} uses an integer-like key (${JSON.stringify(
        key
      )}) alongside the '...' spread token. Integer-like keys are enumerated before other keys regardless of authored order, so their position relative to '...' is ambiguous. Rename the key (e.g. add a non-numeric prefix) or restructure the object.`
    );
    this.name = 'IntegerLikeSpreadKeyError';
  }
}

type SourceMapContext = {
  sourceMap: Record<string, SourceInformation>;
  key: string;
  sourceInformation: SourceInformation;
};

/**
 * `"..."` in `newValue` (as an array element or a key set to `true`)
 * expands the base at that position; otherwise `newValue` replaces
 * `baseValue`. With `deferSpreadsWithoutBase`, an unresolvable spread is
 * preserved so a later merge layer can expand it.
 */
export function getMergeValueResult<T>(
  baseValue: unknown,
  newValue: T | undefined,
  sourceMapContext?: SourceMapContext,
  deferSpreadsWithoutBase?: boolean
): T | undefined {
  if (newValue === undefined && baseValue !== undefined) {
    return baseValue as T;
  }

  if (Array.isArray(newValue)) {
    return mergeArrayValue(
      baseValue,
      newValue,
      sourceMapContext,
      deferSpreadsWithoutBase
    ) as T;
  }

  if (isObject(newValue) && newValue[NX_SPREAD_TOKEN] === true) {
    return mergeObjectWithSpread(
      baseValue,
      newValue,
      sourceMapContext,
      deferSpreadsWithoutBase
    ) as T;
  }

  // Scalar / null / plain object replace — newValue fully wins.
  writeTopLevelSourceMap(sourceMapContext);
  return newValue;
}

function mergeArrayValue<T>(
  baseValue: unknown,
  newValue: T[],
  sourceMapContext: SourceMapContext | undefined,
  deferSpreadsWithoutBase: boolean | undefined
): T[] {
  const newSpreadIndex = newValue.findIndex((v) => v === NX_SPREAD_TOKEN);

  if (newSpreadIndex === -1) {
    // No spread: newValue replaces baseValue entirely.
    if (sourceMapContext) {
      for (let i = 0; i < newValue.length; i++) {
        sourceMapContext.sourceMap[`${sourceMapContext.key}.${i}`] =
          sourceMapContext.sourceInformation;
      }
    }
    writeTopLevelSourceMap(sourceMapContext);
    return newValue;
  }

  const baseArray = Array.isArray(baseValue) ? baseValue : [];
  // Snapshot per-index base sources before we start writing — the loop
  // writes into the same `${key}.${i}` entries it needs to read back when
  // the spread expands. Unlike object spread, array spreads can overwrite
  // indices during their own expansion (when new authors a prefix before
  // `'...'`), so lazy capture isn't sufficient here.
  const basePerIndexSources: Array<SourceInformation | undefined> =
    sourceMapContext
      ? baseArray.map((_, i) =>
          readArrayItemSourceInfo(
            sourceMapContext.sourceMap,
            sourceMapContext.key,
            i
          )
        )
      : [];

  const result: any[] = [];
  const recordAt = (resultIdx: number, info: SourceInformation | undefined) => {
    if (sourceMapContext && info) {
      sourceMapContext.sourceMap[`${sourceMapContext.key}.${resultIdx}`] = info;
    }
  };

  for (
    let newValueIndex = 0;
    newValueIndex < newValue.length;
    newValueIndex++
  ) {
    const element = newValue[newValueIndex];

    if (element === NX_SPREAD_TOKEN) {
      if (deferSpreadsWithoutBase && baseValue === undefined) {
        recordAt(result.length, sourceMapContext?.sourceInformation);
        result.push(NX_SPREAD_TOKEN);
      } else {
        for (let baseIndex = 0; baseIndex < baseArray.length; baseIndex++) {
          recordAt(result.length, basePerIndexSources[baseIndex]);
          result.push(baseArray[baseIndex]);
        }
      }
      continue;
    }

    recordAt(result.length, sourceMapContext?.sourceInformation);
    result.push(element);
  }

  writeTopLevelSourceMap(sourceMapContext);
  return result;
}

function mergeObjectWithSpread(
  baseValue: unknown,
  newValue: Record<string, unknown>,
  sourceMapContext: SourceMapContext | undefined,
  deferSpreadsWithoutBase: boolean | undefined
): Record<string, unknown> {
  const baseObj = isObject(baseValue) ? baseValue : {};
  const result: Record<string, unknown> = {};
  const errorContext = sourceMapContext?.key
    ? `Object at "${sourceMapContext.key}"`
    : 'Object';

  const newKeys = Object.keys(newValue);

  // Integer-like keys are hoisted to the front of enumeration, so if one
  // exists alongside `'...'` it must be newKeys[0].
  if (newKeys[0] && INTEGER_LIKE_KEY_PATTERN.test(newKeys[0])) {
    throw new IntegerLikeSpreadKeyError(newKeys[0], errorContext);
  }

  // Base per-key sources captured lazily — only for shared keys the new
  // object overwrites before `'...'`, since writing their new source
  // clobbers the base entry the spread will need to restore.
  const capturedBaseSources: Record<string, SourceInformation | undefined> = {};

  for (const newKey of newKeys) {
    if (newKey === NX_SPREAD_TOKEN) {
      if (deferSpreadsWithoutBase && baseValue === undefined) {
        // Keep the sentinel for a later merge layer to resolve.
        result[NX_SPREAD_TOKEN] = true;
        continue;
      }
      for (const baseKey of Object.keys(baseObj)) {
        result[baseKey] = baseObj[baseKey];
        if (sourceMapContext) {
          // If we captured a shared key pre-spread, use that; otherwise
          // the source map still holds the base entry untouched.
          const baseSource = Object.prototype.hasOwnProperty.call(
            capturedBaseSources,
            baseKey
          )
            ? capturedBaseSources[baseKey]
            : readObjectPropertySourceInfo(
                sourceMapContext.sourceMap,
                sourceMapContext.key,
                baseKey
              );
          if (baseSource) {
            sourceMapContext.sourceMap[`${sourceMapContext.key}.${baseKey}`] =
              baseSource;
          }
        }
      }
      continue;
    }

    // About to overwrite a base key's source — capture it first so the
    // spread can restore it.
    if (
      sourceMapContext &&
      newKey in baseObj &&
      !Object.prototype.hasOwnProperty.call(capturedBaseSources, newKey)
    ) {
      capturedBaseSources[newKey] = readObjectPropertySourceInfo(
        sourceMapContext.sourceMap,
        sourceMapContext.key,
        newKey
      );
    }

    result[newKey] = newValue[newKey];
    if (sourceMapContext) {
      sourceMapContext.sourceMap[`${sourceMapContext.key}.${newKey}`] =
        sourceMapContext.sourceInformation;
    }
  }

  writeTopLevelSourceMap(sourceMapContext);
  return result;
}

function writeTopLevelSourceMap(ctx: SourceMapContext | undefined): void {
  if (ctx) {
    ctx.sourceMap[ctx.key] = ctx.sourceInformation;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
