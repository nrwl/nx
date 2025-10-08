const { join, basename } = require('path');
const {
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  openSync,
  closeSync,
  unlinkSync,
} = require('fs');
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
  // Check if we should use the native file cache (enabled by default)
  const useNativeFileCache = process.env.NX_SKIP_NATIVE_FILE_CACHE !== 'true';
  // Check if this is an Nx native module (either from npm or local file)
  const isNxNativeModule =
    nxPackages.has(modulePath) ||
    localNodeFiles.some((file) => modulePath.endsWith(file));

  // Only use the file cache for Nx native modules when caching is enabled
  if (useNativeFileCache && isNxNativeModule) {
    const nativeLocation = require.resolve(modulePath);
    const fileName = basename(nativeLocation);

    // we copy the file to a workspace-scoped tmp directory and prefix with nxVersion to avoid stale files being loaded
    const nativeFileCacheLocation = getNativeFileCacheLocation();
    // This is a path to copy to, not the one that gets loaded
    const tmpTmpFile = join(
      nativeFileCacheLocation,
      nxVersion + '-' + Math.random() + fileName
    );
    // This is the path that will get loaded
    const tmpFile = join(nativeFileCacheLocation, nxVersion + '-' + fileName);
    // Lock file to prevent race conditions
    const lockFile = join(nativeFileCacheLocation, '.lock');

    // If the file to be loaded already exists, just load it
    if (existsSync(tmpFile)) {
      return originalLoad.apply(this, [tmpFile, parent, isMain]);
    }

    // If lock file exists, wait for it to disappear (another process is working)
    if (existsSync(lockFile)) {
      const maxWaitMs = 5000;
      const startTime = Date.now();
      while (existsSync(lockFile)) {
        if (Date.now() - startTime > maxWaitMs) {
          break; // Timeout - maybe stale lock, proceed anyway
        }
        const sleep = 10;
        const start = Date.now();
        while (Date.now() - start < sleep) {
          // busy wait
        }
      }

      // After lock disappears, check if file exists now
      if (existsSync(tmpFile)) {
        return originalLoad.apply(this, [tmpFile, parent, isMain]);
      }
    }

    // Create cache dir if needed
    if (!existsSync(nativeFileCacheLocation)) {
      mkdirSync(nativeFileCacheLocation, { recursive: true });
    }

    // Try to create lock
    try {
      const fd = openSync(lockFile, 'wx');
      closeSync(fd);

      // Double-check file doesn't exist (race between wait ending and lock creation)
      if (existsSync(tmpFile)) {
        unlinkSync(lockFile);
        return originalLoad.apply(this, [tmpFile, parent, isMain]);
      }

      // We have the lock - do the copy-rename
      copyFileSync(nativeLocation, tmpTmpFile);
      renameSync(tmpTmpFile, tmpFile);

      // Release lock
      unlinkSync(lockFile);
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Lock was created between our check and now - wait for tmpFile
        const maxWaitMs = 5000;
        const startTime = Date.now();
        while (!existsSync(tmpFile)) {
          if (Date.now() - startTime > maxWaitMs) {
            throw new Error(`Timeout waiting for native module: ${tmpFile}`);
          }
          const sleep = 10;
          const start = Date.now();
          while (Date.now() - start < sleep) {
            // busy wait
          }
        }
      } else {
        throw err;
      }
    }

    // Load from the final location
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
