const { join, basename } = require('path');
const { copyFileSync, existsSync, mkdirSync } = require('fs');
const Module = require('module');
const { nxVersion } = require('../utils/versions');
const { cacheDir } = require('../utils/cache-directory');

const nxPackages = new Set([
  '@nx/nx-android-arm64',
  '@nx/nx-android-arm-eabi',
  '@nx/nx-win32-x64-msvc',
  '@nx/nx-win32-ia32-msvc',
  '@nx/nx-win32-arm64-msvc',
  '@nx/nx-darwin-universal',
  '@nx/nx-darwin-x64',
  '@nx/nx-darwin-arm64',
  '@nx/nx-freebsd-x64',
  '@nx/nx-linux-x64-musl',
  '@nx/nx-linux-x64-gnu',
  '@nx/nx-linux-arm64-musl',
  '@nx/nx-linux-arm64-gnu',
  '@nx/nx-linux-arm-gnueabihf',
]);

const localNodeFiles = [
  'nx.android-arm64.node',
  'nx.android-arm-eabi.node',
  'nx.win32-x64-msvc.node',
  'nx.win32-ia32-msvc.node',
  'nx.win32-arm64-msvc.node',
  'nx.darwin-universal.node',
  'nx.darwin-x64.node',
  'nx.darwin-arm64.node',
  'nx.freebsd-x64.node',
  'nx.linux-x64-musl.node',
  'nx.linux-x64-gnu.node',
  'nx.linux-arm64-musl.node',
  'nx.linux-arm64-gnu.node',
  'nx.linux-arm-gnueabihf.node',
];

const originalLoad = Module._load;

// We override the _load function so that when a native file is required,
// we copy it to a cache directory and require it from there.
// This prevents the file being loaded from node_modules and causing file locking issues.
// Will only be called once because the require cache takes over afterwards.
Module._load = function (request, parent, isMain) {
  const modulePath = request;
  if (
    nxPackages.has(modulePath) ||
    localNodeFiles.some((f) => modulePath.endsWith(f))
  ) {
    const nativeLocation = require.resolve(modulePath);
    const fileName = basename(nativeLocation);
    // we copy the file to the cache directory (.nx/cache by default) and prefix with nxVersion to avoid stale files being loaded
    const tmpFile = join(cacheDir, nxVersion + '-' + fileName);
    if (existsSync(tmpFile)) {
      return originalLoad.apply(this, [tmpFile, parent, isMain]);
    }
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    copyFileSync(nativeLocation, tmpFile);
    return originalLoad.apply(this, [tmpFile, parent, isMain]);
  } else {
    // call the original _load function for everything else
    return originalLoad.apply(this, arguments);
  }
};

const indexModulePath = require.resolve('./native-bindings.js');
delete require.cache[indexModulePath];
const indexModule = require('./native-bindings.js');

module.exports = indexModule;
Module._load = originalLoad;
