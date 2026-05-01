const { join, basename } = require('path');
const {
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
} = require('fs');
const Module = require('module');
const { nxVersion } = require('../utils/versions');
const { getNativeFileCacheLocation } = require('./native-file-cache-location');

const MAX_COPY_RETRIES = 3;

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

function statsOrNull(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function isNoExecError(e) {
  return e.code === 'EACCES' || e.code === 'EPERM';
}

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
    const expectedFileSize = statSync(nativeLocation).size;
    const existingFileStats = statsOrNull(tmpFile);

    // If the file to be loaded already exists, just load it
    if (existingFileStats?.size === expectedFileSize) {
      try {
        return originalLoad.apply(this, [tmpFile, parent, isMain]);
      } catch (e) {
        // If loading from cache fails due to noexec, fall back to original location
        if (isNoExecError(e)) {
          return originalLoad.apply(this, [nativeLocation, parent, isMain]);
        }
        throw e;
      }
    }
    if (!existsSync(nativeFileCacheLocation)) {
      mkdirSync(nativeFileCacheLocation, { recursive: true });
    }

    // Retry copying up to 3 times, validating after each copy
    for (let attempt = 1; attempt <= MAX_COPY_RETRIES; attempt++) {
      // First copy to a unique location for each process
      copyFileSync(nativeLocation, tmpTmpFile);

      // Validate the copy - check file size matches expected
      const copiedFileStats = statsOrNull(tmpTmpFile);
      if (copiedFileStats?.size === expectedFileSize) {
        // Copy succeeded, rename to final location and load
        renameSync(tmpTmpFile, tmpFile);
        try {
          return originalLoad.apply(this, [tmpFile, parent, isMain]);
        } catch (e) {
          // If loading from cache fails due to noexec, fall back to original location
          if (isNoExecError(e)) {
            return originalLoad.apply(this, [nativeLocation, parent, isMain]);
          }
          throw e;
        }
      }

      // Copy failed validation, clean up the malformed file
      try {
        unlinkSync(tmpTmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }

    // All retries failed - warn and load from original location
    console.warn(
      `Warning: Failed to copy native module to cache after ${MAX_COPY_RETRIES} attempts. ` +
        `Loading from original location instead. ` +
        `This may cause file locking issues on Windows.`
    );
    return originalLoad.apply(this, [nativeLocation, parent, isMain]);
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
