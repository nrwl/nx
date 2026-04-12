module.exports = new Proxy(
  {},
  {
    get(_, key) {
      return key === '__esModule' ? false : key;
    },
  }
);
