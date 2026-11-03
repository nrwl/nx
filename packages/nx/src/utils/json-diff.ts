import { diffJson } from '../native';
import { Change } from '../project-graph/file-utils';

export enum JsonDiffType {
  Deleted = 'JsonPropertyDeleted',
  Added = 'JsonPropertyAdded',
  Modified = 'JsonPropertyModified',
}

export interface JsonChange extends Change {
  type: JsonDiffType;
  path: string[];
  value: {
    lhs: any;
    rhs: any;
  };
}

export function isJsonChange(change: Change): change is JsonChange {
  return (
    change.type === JsonDiffType.Added ||
    change.type === JsonDiffType.Deleted ||
    change.type === JsonDiffType.Modified
  );
}

/**
 * The changes from `lhs` to `rhs`: every path whose value was deleted or
 * modified, containers included, then every added path.
 */
export function jsonDiff(lhs: any, rhs: any): JsonChange[] {
  return (
    (diffJson(JSON.stringify(lhs ?? null), JSON.stringify(rhs ?? null)) as
      | JsonChange[]
      | null) ?? []
  );
}
