export enum DiffType {
  Deleted,
  Added,
  Modified
}

export interface JsonValueDiff {
  type: DiffType;
  path: string[];
  value: {
    lhs: any;
    rhs: any;
  };
}

export function jsonDiff(lhs: any, rhs: any): JsonValueDiff[] {
  const result: JsonValueDiff[] = [];
  const seen = new Set<string>();

  walkJsonTree(lhs, [], (path, lhsValue) => {
    seen.add(hashArray(path));
    if (typeof lhsValue === 'object') {
      return true;
    }
    const rhsValue = getJsonValue(path, rhs);
    if (rhsValue === undefined) {
      result.push({
        type: DiffType.Deleted,
        path,
        value: {
          lhs: lhsValue,
          rhs: undefined
        }
      });
    } else if (lhsValue !== rhsValue) {
      result.push({
        type: DiffType.Modified,
        path,
        value: {
          lhs: lhsValue,
          rhs: rhsValue
        }
      });
    }
    return false;
  });

  walkJsonTree(rhs, [], (path, rhsValue) => {
    if (seen.has(hashArray(path))) {
      return false;
    } else if (typeof rhsValue === 'object') {
      return true;
    } else {
      result.push({
        type: DiffType.Added,
        path,
        value: {
          lhs: undefined,
          rhs: rhsValue
        }
      });
      return false;
    }
  });

  return result;
}

// Depth-first walk down JSON tree.
function walkJsonTree(
  json: any,
  currPath: string[],
  visitor: (path: string[], value: any) => boolean
) {
  if (!json || typeof json !== 'object') {
    return;
  }

  Object.keys(json).forEach(key => {
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
