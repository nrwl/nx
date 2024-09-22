const { join, basename } = require('path');
const { copyFileSync, existsSync, mkdirSync, constants } = require('fs');
const Module = require('module');
const { nxVersion } = require('../utils/versions');
const { getNativeFileCacheLocation } = require('./native-file-cache-location');

// WASI is still experimental and throws a warning when used
// We spawn many many processes so the warning gets printed a lot
// We have a different warning elsewhere to warn people using WASI
const originalEmit = process.emit;
process.emit = function (eventName, eventData) {
  if (
    eventName === `warning` &&
    typeof eventData === `object` &&
    eventData?.name === `ExperimentalWarning` &&
    eventData?.message?.includes(`WASI`)
  ) {
    return false;
  }
  return originalEmit.apply(process, arguments);
};

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

    // we copy the file to a workspace-scoped tmp directory and prefix with nxVersion to avoid stale files being loaded
    const nativeFileCacheLocation = getNativeFileCacheLocation();
    const tmpFile = join(nativeFileCacheLocation, nxVersion + '-' + fileName);
    if (existsSync(tmpFile)) {
      return originalLoad.apply(this, [tmpFile, parent, isMain]);
    }

    mkdirSync(nativeFileCacheLocation, { recursive: true });

    let iteratedFilename = tmpFile;

    const maxRetries = 50;

    for (let i = 0; i < maxRetries; i++) {
      try {
        copyFileSync(nativeLocation, iteratedFilename, constants.COPYFILE_EXCL);
        break;
      } catch (e) {
        if (e.code === 'EEXIST' && i !== maxRetries - 1) {
          // Another process wrote to the file at the same time.
          // This can happen when multiple instances of the same nx version are being installed in parallel.
          // We can ignore this error because the other process is writing the same file content, but won over us.
          // We still need to write our own file, to guarantee that the content is completely written before loading it.
          iteratedFilename = tmpFile + '-' + (i + 1);
          continue;
        } else {
          throw e;
        }
      }
    }

    return originalLoad.apply(this, [iteratedFilename, parent, isMain]);
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
