const nxJsBabelPreset = require('@nx/js/babel');

/** @deprecated Use `@nx/js/babel`. */
module.exports = function (api: any, options: any = {}) {
  console.warn(
    '`@nx/web/babel` has been deprecated. Use `@nx/js/babel` instead in your .babelrc files.'
  );
  return nxJsBabelPreset(api, options);
};
