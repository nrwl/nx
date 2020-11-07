function isObject(v) {
  return '[object Object]' === Object.prototype.toString.call(v);
}

export function sortObject(o: any) {
  if (Array.isArray(o)) {
    return o.sort().map(sortObject);
  } else if (isObject(o)) {
    return Object.keys(o)
      .sort()
      .reduce((a, k) => {
        a[k] = sortObject(o[k]);

        return a;
      }, {});
  }

  return o;
}
