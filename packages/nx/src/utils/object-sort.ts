export function sortObjectByKeys<T extends Record<string, unknown>>(originalObject: T) {
  const keys = Object.keys(originalObject).sort();

  const sortedObject: Record<string, unknown> = {};
  keys.forEach((key) => (sortedObject[key] = originalObject[key]));

  return sortedObject as T;
}
