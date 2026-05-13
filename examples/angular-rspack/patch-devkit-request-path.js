const Module = require('module');
const path = require('path');

// Map of bare-specifier requests that need to be redirected to the workspace
// source instead of the installed published copy at `node_modules/`. The
// installed `@nx/js@<pinned-version>` predates the `./internal` exports entry,
// so any built dist code (e.g. `dist/packages/module-federation/...`) that
// requires `@nx/js/internal` would otherwise fail to resolve.
const SOURCE_REDIRECTS = {
  '@nx/module-federation/angular': path.resolve(
    __dirname,
    '../../dist/packages/module-federation/angular'
  ),
  '@nx/js/internal': path.resolve(__dirname, '../../packages/js/dist/internal'),
};

module.exports = {
  // Required to use the built module federation package rather than installed.
  patchModuleFederationRequestPath() {
    const originalResolveFilename = Module._resolveFilename;

    Module._resolveFilename = function (request, parent, isMain) {
      const redirect = SOURCE_REDIRECTS[request];
      if (redirect) {
        try {
          return originalResolveFilename.call(this, redirect, parent, isMain);
        } catch {
          console.error(
            `Could not resolve "${request}" via workspace redirect to "${redirect}"`
          );
        }
      }

      return originalResolveFilename.call(this, request, parent, isMain);
    };
    return () => {
      Module._resolveFilename = originalResolveFilename;
    };
  },
};
