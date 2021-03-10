const { join } = require('path');
const { appRootPath } = require('@nrwl/workspace/src/utilities/app-root');
const { workspaceLayout } = require('@nrwl/workspace/src/core/file-utils');

function regexEqual(x, y) {
  return (
    x instanceof RegExp &&
    y instanceof RegExp &&
    x.source === y.source &&
    x.global === y.global &&
    x.ignoreCase === y.ignoreCase &&
    x.multiline === y.multiline
  );
}

function withNx(nextConfig = {} as any) {
  /**
   * In collaboration with Vercel themselves, we have been advised to set the "experimental-serverless-trace" target
   * if we detect that the build is running on Vercel to allow for the most ergonomic configuration for Vercel users.
   */
  if (process.env.NOW_BUILDER) {
    console.log(
      'withNx() plugin: Detected Vercel build environment, applying "experimental-serverless-trace" target'
    );
    nextConfig.target = 'experimental-serverless-trace';
  }

  const userWebpack = nextConfig.webpack || ((x) => x);
  return {
    ...nextConfig,
    webpack: (config, options) => {
      /*
       * Update babel to support our monorepo setup.
       * The 'upward' mode allows the root babel.config.json and per-project .babelrc files to be picked up.
       */
      options.defaultLoaders.babel.options.babelrc = true;
      options.defaultLoaders.babel.options.rootMode = 'upward';

      /*
       * Modify the Next.js webpack config to allow workspace libs to use css modules.
       * Note: This would be easier if Next.js exposes css-loader and sass-loader on `defaultLoaders`.
       */

      // Include workspace libs in css/sass loaders
      const includes = [join(appRootPath, workspaceLayout().libsDir)];

      const nextCssLoaders = config.module.rules.find(
        (rule) => typeof rule.oneOf === 'object'
      );

      // webpack config is not as expected
      if (!nextCssLoaders) return config;

      /*
       *  1. Modify css loader to enable module support for workspace libs
       */
      const nextCssLoader = nextCssLoaders.oneOf.find(
        (rule) =>
          rule.sideEffects === false && regexEqual(rule.test, /\.module\.css$/)
      );
      // Might not be found if Next.js webpack config changes in the future
      if (nextCssLoader) {
        nextCssLoader.issuer.or = nextCssLoader.issuer.and
          ? nextCssLoader.issuer.and.concat(includes)
          : includes;
        delete nextCssLoader.issuer.and;
      }

      /*
       *  2. Modify sass loader to enable module support for workspace libs
       */
      const nextSassLoader = nextCssLoaders.oneOf.find(
        (rule) =>
          rule.sideEffects === false &&
          regexEqual(rule.test, /\.module\.(scss|sass)$/)
      );
      // Might not be found if Next.js webpack config changes in the future
      if (nextSassLoader) {
        nextSassLoader.issuer.or = nextSassLoader.issuer.and
          ? nextSassLoader.issuer.and.concat(includes)
          : includes;
        delete nextSassLoader.issuer.and;
      }

      /*
       *  3. Modify error loader to ignore css modules used by workspace libs
       */
      const nextErrorCssModuleLoader = nextCssLoaders.oneOf.find(
        (rule) =>
          rule.use &&
          rule.use.loader === 'error-loader' &&
          rule.use.options &&
          (rule.use.options.reason ===
            'CSS Modules \u001b[1mcannot\u001b[22m be imported from within \u001b[1mnode_modules\u001b[22m.\n' +
              'Read more: https://err.sh/next.js/css-modules-npm' ||
            rule.use.options.reason ===
              'CSS Modules cannot be imported from within node_modules.\nRead more: https://err.sh/next.js/css-modules-npm')
      );
      // Might not be found if Next.js webpack config changes in the future
      if (nextErrorCssModuleLoader) {
        nextErrorCssModuleLoader.exclude = includes;
      }

      return userWebpack(config, options);
    },
  };
}

module.exports = withNx;
