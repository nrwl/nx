export function sortObjectByKeys(originalObject: object) {
  const keys = Object.keys(originalObject).sort();

  const sortedObject = {};
  keys.forEach((key) => (sortedObject[key] = originalObject[key]));

  return sortedObject;
}
