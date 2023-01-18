const nxJsBabelPreset = require('@nrwl/js/babel');

/** @deprecated Use `@nrwl/js/babel`. */
module.exports = function (api: any, options: any = {}) {
  console.warn(
    '`@nrwl/web/babel` has been deprecated. Use `@nrwl/js/babel` instead.'
  );
  return nxJsBabelPreset(api, options);
};
