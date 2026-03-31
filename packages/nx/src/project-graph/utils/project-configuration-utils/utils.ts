import { NX_PREFIX } from '../../../utils/logger';
import type {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../../config/workspace-json-project-json';
import type { SourceInformation } from '../project-configuration/source-maps';

const NX_SPREAD_TOKEN = '...';

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Returns deduplicated keys from all provided objects.
 */
export function uniqueKeysInObjects(...objs: Record<string, any>[]): string[] {
  const keys = new Set<string>();
  for (const obj of objs) {
    if (obj) {
      for (const key of Object.keys(obj)) {
        keys.add(key);
      }
    }
  }
  return Array.from(keys);
}

/**
 * Merges two values, supporting a spread token ('...') for arrays and objects.
 *
 * For arrays: The spread token ('...') acts as a placeholder that gets replaced
 * with all elements from the base array. E.g., `['a', '...', 'b']` merged with
 * base `['x', 'y']` produces `['a', 'x', 'y', 'b']`.
 *
 * For objects: A key of '...' set to `true` causes base object properties
 * to be spread into the result at that position. Keys defined after '...' will
 * override base properties.
 *
 * If no spread token is found, newValue fully replaces baseValue.
 *
 * When `sourceMapContext` is provided, the source map is updated per property
 * to track which source each element/key came from. The existing source map
 * entry for `key` is used as the base source information.
 */
export function getMergeValueResult(
  baseValue: any,
  newValue: any,
  sourceMapContext?: {
    sourceMap: Record<string, SourceInformation>;
    key: string;
    sourceInformation: SourceInformation;
  }
): any {
  // no new value, use old value — source map stays as-is (base source)
  if (newValue === undefined && baseValue !== undefined) {
    return baseValue;
  }

  // Check for spread syntax before type-mismatch bailout, since spread
  // should work even when baseValue is undefined (treated as empty)
  if (Array.isArray(newValue)) {
    const spreadIndex = newValue.findIndex((v) => v === NX_SPREAD_TOKEN);
    if (spreadIndex !== -1) {
      const baseArray = Array.isArray(baseValue) ? baseValue : [];
      const baseSourceInfo = sourceMapContext?.sourceMap[sourceMapContext.key];

      // Build the result array element by element so we can track each
      // element's source in the source map.
      const result: any[] = [];
      let resultIdx = 0;
      for (let i = 0; i < newValue.length; i++) {
        if (newValue[i] === NX_SPREAD_TOKEN) {
          for (let j = 0; j < baseArray.length; j++) {
            result.push(baseArray[j]);
            if (sourceMapContext && baseSourceInfo) {
              sourceMapContext.sourceMap[
                `${sourceMapContext.key}.${resultIdx}`
              ] = baseSourceInfo;
            }
            resultIdx++;
          }
        } else {
          result.push(newValue[i]);
          if (sourceMapContext) {
            sourceMapContext.sourceMap[`${sourceMapContext.key}.${resultIdx}`] =
              sourceMapContext.sourceInformation;
          }
          resultIdx++;
        }
      }
      if (sourceMapContext) {
        sourceMapContext.sourceMap[sourceMapContext.key] =
          sourceMapContext.sourceInformation;
      }
      return result;
    }
    // no spread token, and looking at an array, so return new array.
    if (sourceMapContext) {
      sourceMapContext.sourceMap[sourceMapContext.key] =
        sourceMapContext.sourceInformation;
    }
    return newValue;
  } else if (
    // new value is a non-null object, that we know is not an array
    typeof newValue === 'object' &&
    newValue != null &&
    // '...' is explicitly set to `true`
    newValue[NX_SPREAD_TOKEN] === true
  ) {
    const baseObj =
      typeof baseValue === 'object' && baseValue != null ? baseValue : {};
    const baseSourceInfo = sourceMapContext?.sourceMap[sourceMapContext.key];

    // Build the result object key by key so we can track each property's
    // source in the source map. The last write wins — if a key appears in
    // both new and base, the one that comes later in iteration order wins.
    const res: any = {};
    const newKeys = Object.keys(newValue);
    for (const newKey of newKeys) {
      if (newKey !== NX_SPREAD_TOKEN) {
        res[newKey] = newValue[newKey];
        if (sourceMapContext) {
          sourceMapContext.sourceMap[`${sourceMapContext.key}.${newKey}`] =
            sourceMapContext.sourceInformation;
        }
      } else {
        for (const baseKey in baseObj) {
          res[baseKey] = baseObj[baseKey];
          if (sourceMapContext && baseSourceInfo) {
            sourceMapContext.sourceMap[`${sourceMapContext.key}.${baseKey}`] =
              baseSourceInfo;
          }
        }
      }
    }
    if (sourceMapContext) {
      sourceMapContext.sourceMap[sourceMapContext.key] =
        sourceMapContext.sourceInformation;
    }
    return res;
  }

  if (sourceMapContext) {
    sourceMapContext.sourceMap[sourceMapContext.key] =
      sourceMapContext.sourceInformation;
  }
  return newValue;
}

export function resolveCommandSyntacticSugar(
  target: TargetConfiguration,
  key: string
): TargetConfiguration {
  const { command, ...config } = target ?? {};

  if (!command) {
    return target;
  }

  if (config.executor) {
    throw new Error(
      `${NX_PREFIX} Project at ${key} should not have executor and command both configured.`
    );
  } else {
    return {
      ...config,
      executor: 'nx:run-commands',
      options: {
        ...config.options,
        command: command,
      },
    };
  }
}

export function resolveNxTokensInOptions<T extends Object | Array<unknown>>(
  object: T,
  project: ProjectConfiguration,
  key: string
): T {
  const result: T = Array.isArray(object) ? ([...object] as T) : { ...object };
  for (let [opt, value] of Object.entries(object ?? {})) {
    if (typeof value === 'string') {
      const workspaceRootMatch = /^(\{workspaceRoot\}\/?)/.exec(value);
      if (workspaceRootMatch?.length) {
        value = value.replace(workspaceRootMatch[0], '');
      }
      if (value.includes('{workspaceRoot}')) {
        throw new Error(
          `${NX_PREFIX} The {workspaceRoot} token is only valid at the beginning of an option. (${key})`
        );
      }
      value = value.replace(/\{projectRoot\}/g, project.root);
      result[opt] = value.replace(/\{projectName\}/g, project.name);
    } else if (typeof value === 'object' && value) {
      result[opt] = resolveNxTokensInOptions(
        value,
        project,
        [key, opt].join('.')
      );
    }
  }
  return result;
}
