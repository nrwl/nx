export function sortObjectByKeys<T extends object>(originalObject: T): T {
  const keys = Object.keys(originalObject).sort();

  const sortedObject: Record<string, unknown> = {};
  keys.forEach((key) => (sortedObject[key] = Reflect.get(originalObject, key)));

  return sortedObject as T;
}
