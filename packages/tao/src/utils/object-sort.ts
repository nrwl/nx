export function sortObjectByKeys(originalObject: object) {
  return Object.keys(originalObject)
    .sort()
    .reduce((obj, key) => {
      return {
        ...obj,
        [key]: originalObject[key],
      };
    }, {});
}
