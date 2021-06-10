export function objectSortByKeys(originalObject: object) {
  return Object.keys(originalObject)
    .sort()
    .reduce((obj, key) => {
      obj[key] = originalObject[key];
      return obj;
    }, {});
}
