export enum ChangeType {
  Delete = 'Delete',
  Insert = 'Insert',
}

export interface StringDeletion {
  type: ChangeType.Delete;
  /**
   * Place in the original text to start deleting characters
   */
  start: number;
  /**
   * Number of characters to delete
   */
  length: number;
}

export interface StringInsertion {
  type: ChangeType.Insert;
  /**
   * Text to insert into the original text
   */
  text: string;
  /**
   * Place in the original text to insert new text
   */
  index: number;
}

/**
 * A change to be made to a string
 */
export type StringChange = StringInsertion | StringDeletion;

/**
 * Applies a list of changes to a string's original value.
 *
 * This is useful when working with ASTs.
 *
 * For Example, to rename a property in a method's options:
 *
 * ```typescript
 * const code = `bootstrap({
 *   target: document.querySelector('#app')
 * })`;
 *
 * const indexOfPropertyName = 13; // Usually determined by analyzing an AST.
 * const updatedCode = applyChangesToString(code, [
 *   {
 *     type: ChangeType.Insert,
 *     index: indexOfPropertyName,
 *     text: 'element'
 *   },
 *   {
 *     type: ChangeType.Delete,
 *     start: indexOfPropertyName,
 *     length: 6
 *   },
 * ]);
 *
 * bootstrap({
 *   element: document.querySelector('#app')
 * });
 * ```
 */
export function applyChangesToString(
  text: string,
  changes: StringChange[]
): string {
  assertChangesValid(changes);
  const sortedChanges = changes.sort((a, b) => {
    const diff = getChangeIndex(a) - getChangeIndex(b);
    if (diff === 0) {
      if (a.type === b.type) {
        return 0;
      } else {
        // When at the same place, Insert before Delete
        return isStringInsertion(a) ? -1 : 1;
      }
    }
    return diff;
  });
  let offset = 0;
  for (const change of sortedChanges) {
    const index = getChangeIndex(change) + offset;
    if (isStringInsertion(change)) {
      text = text.substring(0, index) + change.text + text.substring(index);
      offset += change.text.length;
    } else {
      text = text.substring(0, index) + text.substring(index + change.length);
      offset -= change.length;
    }
  }
  return text;
}

function assertChangesValid(
  changes: Array<StringInsertion | StringDeletion>
): void {
  for (const change of changes) {
    if (isStringInsertion(change)) {
      if (!Number.isInteger(change.index)) {
        throw new TypeError(`${change.index} must be an integer.`);
      }
      if (change.index < 0) {
        throw new Error(`${change.index} must be a positive integer.`);
      }
      if (typeof change.text !== 'string') {
        throw new Error(`${change.text} must be a string.`);
      }
    } else {
      if (!Number.isInteger(change.start)) {
        throw new TypeError(`${change.start} must be an integer.`);
      }
      if (change.start < 0) {
        throw new Error(`${change.start} must be a positive integer.`);
      }
      if (!Number.isInteger(change.length)) {
        throw new TypeError(`${change.length} must be an integer.`);
      }
      if (change.length < 0) {
        throw new Error(`${change.length} must be a positive integer.`);
      }
    }
  }
}

function getChangeIndex(change: StringChange): number {
  if (isStringInsertion(change)) {
    return change.index;
  } else {
    return change.start;
  }
}

function isStringInsertion(change: StringChange): change is StringInsertion {
  return change.type === ChangeType.Insert;
}
