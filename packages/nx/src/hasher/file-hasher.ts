export function hashArray(content: string[]): string {
  // Import as needed. There is also an issue running unit tests in Nx repo if this is a top-level import.
  const { hashArray } = require('../native');
  return hashArray(content);
}

export function hashObject(obj: object): string {
  const { hashArray } = require('../native');

  if (!obj) {
    return hashArray([]);
  }

  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return hashArray([]);
  }

  // Sort keys for deterministic hashing
  keys.sort();

  // Pre-allocate array for better performance
  const parts: string[] = new Array(keys.length * 2);
  let idx = 0;

  for (const key of keys) {
    parts[idx++] = key;
    const value = obj[key];
    // Avoid JSON.stringify for primitive values (common case)
    if (value === null) {
      parts[idx++] = 'null';
    } else if (value === undefined) {
      parts[idx++] = 'undefined';
    } else if (typeof value === 'string') {
      parts[idx++] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      parts[idx++] = String(value);
    } else {
      // Only use JSON.stringify for objects/arrays
      parts[idx++] = JSON.stringify(value);
    }
  }

  return hashArray(parts);
}

export function hashFile(filePath: string): string {
  const { hashFile } = require('../native');

  return hashFile(filePath);
}
