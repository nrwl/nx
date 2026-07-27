const { join, basename } = require('path');
const { copyFileSync, renameSync, statSync, unlinkSync } = require('fs');
const { createHash } = require('crypto');
const Module = require('module');
const { nxVersion } = require('../utils/versions');
const {
  ensureSecureNativeFileCacheLocation,
} = require('./native-file-cache-location');

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

function removeIfPresent(path) {
  try {
    unlinkSync(path);
  } catch {
    // Ignore cleanup errors
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

    // Securely resolve the per-user cache dir. Returns null when it cannot be
    // created and *trusted* (e.g. a sandbox with no write allowance yet, or a
    // per-uid dir another local user pre-created under the world-writable
    // root). In that case load the binding in place from node_modules — that
    // is strictly better than failing to load, and safer than loading a file
    // from a directory we don't own.
    const nativeFileCacheLocation = ensureSecureNativeFileCacheLocation();
    if (!nativeFileCacheLocation) {
      return originalLoad.apply(this, [nativeLocation, parent, isMain]);
    }

    // The cache dir is keyed by nx version, which is NOT enough on its own:
    // in a source checkout `nxVersion` is the placeholder 0.0.1 for every
    // worktree on the machine, so without this every checkout would share one
    // slot and a rebuild in one would be picked up by the others. Hashing the
    // resolved binding path keeps each checkout (and each installed copy) in
    // its own entry.
    const cacheKey =
      nxVersion +
      '-' +
      createHash('sha256')
        .update(nativeLocation)
        .digest('hex')
        .substring(0, 12);

    // This is a path to copy to, not the one that gets loaded
    const tmpTmpFile = join(
      nativeFileCacheLocation,
      cacheKey + '-' + Math.random() + fileName
    );
    // This is the path that will get loaded
    const tmpFile = join(nativeFileCacheLocation, cacheKey + '-' + fileName);
    const sourceStats = statSync(nativeLocation);
    const expectedFileSize = sourceStats.size;
    const existingFileStats = statsOrNull(tmpFile);

    // Size alone does not detect a rebuilt binding: a small Rust edit routinely
    // produces a byte-identical size. Treat a cache entry older than the source
    // as stale so a rebuild is picked up rather than silently ignored.
    const isFresh =
      existingFileStats?.size === expectedFileSize &&
      existingFileStats.mtimeMs >= sourceStats.mtimeMs;

    // If the file to be loaded already exists and is current, just load it
    if (isFresh) {
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

    // Retry copying up to 3 times, validating after each copy
    let attemptsMade = 0;
    for (let attempt = 1; attempt <= MAX_COPY_RETRIES; attempt++) {
      attemptsMade = attempt;
      // First copy to a unique location for each process
      try {
        copyFileSync(nativeLocation, tmpTmpFile);
      } catch {
        // Permission errors won't heal on retry — use the load-in-place
        // fallback below. A throwing copy can still have created a partial
        // file, and nothing else will ever look at this unique name.
        removeIfPresent(tmpTmpFile);
        break;
      }

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
      removeIfPresent(tmpTmpFile);
    }

    // Copying failed - warn and load from original location
    console.warn(
      `Warning: Failed to copy native module to cache after ${attemptsMade} attempt${
        attemptsMade === 1 ? '' : 's'
      }. ` +
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
