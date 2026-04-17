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

type SourceMapContext = {
  sourceMap: Record<string, SourceInformation>;
  key: string;
  sourceInformation: SourceInformation;
};

/**
 * Merges two values. `"..."` anywhere in `newValue` (as an array element
 * or as a key set to `true` on an object) expands the base at that
 * position. Without a spread token `newValue` fully replaces `baseValue`.
 *
 * When `preserveUnknownSpreads` is set and `baseValue` is undefined, the
 * spread sentinel is kept in the result so a later merge can resolve it.
 */
export function getMergeValueResult<T>(
  baseValue: unknown,
  newValue: T | undefined,
  sourceMapContext?: SourceMapContext,
  preserveUnknownSpreads?: boolean
): T | undefined {
  if (newValue === undefined && baseValue !== undefined) {
    return baseValue as T;
  }

  if (Array.isArray(newValue)) {
    return mergeArrayValue(
      baseValue,
      newValue,
      sourceMapContext,
      preserveUnknownSpreads
    ) as T;
  }

  if (isObject(newValue) && newValue[NX_SPREAD_TOKEN] === true) {
    return mergeObjectWithSpread(
      baseValue,
      newValue,
      sourceMapContext,
      preserveUnknownSpreads
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
  preserveUnknownSpreads: boolean | undefined
): T[] {
  const newSpreadIndex = newValue.findIndex((v) => v === NX_SPREAD_TOKEN);

  if (newSpreadIndex === -1) {
    // No spread — newValue fully replaces baseValue. Always write
    // per-item source info so downstream consumers get accurate
    // attribution for every surviving element, not just the array as a
    // whole.
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
  // Snapshot per-index base attribution *before* the write loop runs:
  // we'll be writing into `arr.0`, `arr.1`, … in result order, which
  // would clobber the base entries we still need to read when the
  // spread expands. Reading lazily here would mix freshly-written new
  // sources into base lookups and lose attribution for items that came
  // from earlier merge layers.
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
      if (preserveUnknownSpreads && baseValue === undefined) {
        recordAt(result.length, sourceMapContext?.sourceInformation);
        result.push(NX_SPREAD_TOKEN);
      } else {
        for (let baseIndex = 0; baseIndex < baseArray.length; baseIndex++) {
          // Prefer the original per-index attribution (whoever wrote
          // `arr.${baseIndex}` first); the helper falls back to the
          // parent-key source for items that had no per-index entry.
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
  preserveUnknownSpreads: boolean | undefined
): Record<string, unknown> {
  const baseObj = isObject(baseValue) ? baseValue : {};
  const result: Record<string, unknown> = {};

  for (const newKey of Object.keys(newValue)) {
    if (newKey === NX_SPREAD_TOKEN) {
      if (preserveUnknownSpreads && baseValue === undefined) {
        // Preserve the sentinel for a later merge. No source-map entry
        // is written: the `...` key is a merge marker, not a real
        // property that will reach the final output.
        result[NX_SPREAD_TOKEN] = true;
        continue;
      }
      for (const baseKey of Object.keys(baseObj)) {
        result[baseKey] = baseObj[baseKey];
        if (sourceMapContext) {
          // Prefer the existing per-key attribution — the base entry
          // already knows who set it. The helper falls back to the
          // parent-key source when the per-key entry hasn't been recorded.
          const baseSource = readObjectPropertySourceInfo(
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
