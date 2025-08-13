const Module = require('module');
const path = require('path');

module.exports = {
  patchDevkitRequestPath() {
    const originalResolveFilename = Module._resolveFilename;

    Module._resolveFilename = function (request, parent, isMain) {
      if (request === '@nx/devkit') {
        const possiblePaths = [
          path.resolve(__dirname, '../../dist/packages/devkit'),
        ];

        for (const tryPath of possiblePaths) {
          try {
            return originalResolveFilename.call(this, tryPath, parent, isMain);
          } catch (err) {
            // Continue to next path
          }
        }

        // If none work, fall back to original error
        console.error(`Could not find @nx/devkit in any of the fallback paths`);
      }

      return originalResolveFilename.call(this, request, parent, isMain);
    };
    return () => {
      Module._resolveFilename = originalResolveFilename;
    };
  },
};
