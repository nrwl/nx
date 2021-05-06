import { Change } from '../core/file-utils';

export enum DiffType {
  Deleted = 'JsonPropertyDeleted',
  Added = 'JsonPropertyAdded',
  Modified = 'JsonPropertyModified',
}

export interface JsonChange extends Change {
  type: DiffType;
  path: string[];
  value: {
    lhs: any;
    rhs: any;
  };
}

export function isJsonChange(change: Change): change is JsonChange {
  return (
    change.type === DiffType.Added ||
    change.type === DiffType.Deleted ||
    change.type === DiffType.Modified
  );
}

export function jsonDiff(lhs: any, rhs: any): JsonChange[] {
  const result: JsonChange[] = [];
  const seenInLhs = new Set<string>();

  walkJsonTree(lhs, [], (path, lhsValue) => {
    seenInLhs.add(hashArray(path));
    const rhsValue = getJsonValue(path, rhs);
    if (rhsValue === undefined) {
      result.push({
        type: DiffType.Deleted,
        path,
        value: {
          lhs: lhsValue,
          rhs: undefined,
        },
      });
    } else if (!deepEquals(lhsValue, rhsValue)) {
      result.push({
        type: DiffType.Modified,
        path,
        value: {
          lhs: lhsValue,
          rhs: rhsValue,
        },
      });
    }
    return typeof lhsValue === 'object' || Array.isArray(lhsValue);
  });

  walkJsonTree(rhs, [], (path, rhsValue) => {
    const addedInRhs = !seenInLhs.has(hashArray(path));
    if (addedInRhs) {
      result.push({
        type: DiffType.Added,
        path,
        value: {
          lhs: undefined,
          rhs: rhsValue,
        },
      });
    }
    return typeof rhsValue === 'object' || Array.isArray(rhsValue);
  });

  return result;
}

// Depth-first walk down JSON tree.
export function walkJsonTree(
  json: any,
  currPath: string[],
  visitor: (path: string[], value: any) => boolean
) {
  if (!json || typeof json !== 'object') {
    return;
  }
  Object.keys(json).forEach((key) => {
    const path = currPath.concat([key]);
    const shouldContinue = visitor(path, json[key]);
    if (shouldContinue) {
      walkJsonTree(json[key], path, visitor);
    }
  });
}

function hashArray(ary: string[]) {
  return JSON.stringify(ary);
}

function getJsonValue(path: string[], json: any): void | any {
  let curr = json;
  for (const k of path) {
    curr = curr[k];
    if (curr === undefined) {
      break;
    }
  }
  return curr;
}

function deepEquals(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  // Values do not need to be checked for deep equality and the above is false
  if (
    // Values are different types
    typeof a !== typeof b ||
    // Values are the same type but not an object or array
    (typeof a !== 'object' && !Array.isArray(a)) ||
    // Objects are the same type, objects or arrays, but do not have the same number of keys
    Object.keys(a).length !== Object.keys(b).length
  ) {
    return false;
  }

  // Values need to be checked for deep equality
  return Object.entries(a).reduce((equal, [key, aValue]) => {
    // Skip other keys if it is already not equal.
    if (!equal) {
      return equal;
    }

    // Traverse the object
    return deepEquals(aValue, b[key]);
  }, true);
}
