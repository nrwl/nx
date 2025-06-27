/**
 * Re-export from TypeScript file for require.resolve compatibility in TS solution workspaces.
 * 
 * This file is necessary because:
 * 1. The package.json points to "src/index.js" as the main entry point
 * 2. In TypeScript solution workspaces, packages link to source code (not built dist)
 * 3. The hasNxJsPlugin() function in packages/nx/src/utils/package-json.ts uses require.resolve('@nx/js')
 * 4. This enables the nx-release-publish target to be properly inferred for framework packages
 * 
 * Without this file, require.resolve('@nx/js') would fail and framework packages like
 * @nx/angular, @nx/react, etc. would not get the nx-release-publish target, causing
 * publishing to fail during e2e tests and releases.
 */
module.exports = require('./index.ts');
