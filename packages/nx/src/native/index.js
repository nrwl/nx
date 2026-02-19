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

/**
 * Get the expected native binary package name for the current platform.
 * Returns null if the platform is unsupported.
 */
function getExpectedNativePackage() {
  const platform = process.platform;
  const arch = process.arch;

  // Check for musl vs glibc on Linux
  const isMusl = (() => {
    if (platform !== 'linux') return false;
    try {
      const { readFileSync } = require('fs');
      return readFileSync('/usr/bin/ldd', 'utf-8').includes('musl');
    } catch {
      try {
        return require('child_process')
          .execSync('ldd --version', { encoding: 'utf8' })
          .includes('musl');
      } catch {
        return false;
      }
    }
  })();

  if (platform === 'win32') {
    if (arch === 'x64') return '@nx/nx-win32-x64-msvc';
    if (arch === 'ia32') return '@nx/nx-win32-ia32-msvc';
    if (arch === 'arm64') return '@nx/nx-win32-arm64-msvc';
  } else if (platform === 'darwin') {
    // Darwin has a universal binary, try that first
    return '@nx/nx-darwin-universal';
  } else if (platform === 'linux') {
    if (arch === 'x64') {
      return isMusl ? '@nx/nx-linux-x64-musl' : '@nx/nx-linux-x64-gnu';
    }
    if (arch === 'arm64') {
      return isMusl ? '@nx/nx-linux-arm64-musl' : '@nx/nx-linux-arm64-gnu';
    }
    if (arch === 'arm') {
      return isMusl
        ? '@nx/nx-linux-arm-musleabihf'
        : '@nx/nx-linux-arm-gnueabihf';
    }
  } else if (platform === 'freebsd') {
    if (arch === 'x64') return '@nx/nx-freebsd-x64';
  }
  return null;
}

/**
 * Check if the native binary for this platform can be resolved.
 */
function canResolveNativeBinary() {
  const expectedPackage = getExpectedNativePackage();
  if (!expectedPackage) return false;

  try {
    require.resolve(expectedPackage);
    return true;
  } catch {
    // Also check for local .node files
    const localFiles = {
      '@nx/nx-darwin-universal': 'nx.darwin-universal.node',
      '@nx/nx-darwin-x64': 'nx.darwin-x64.node',
      '@nx/nx-darwin-arm64': 'nx.darwin-arm64.node',
      '@nx/nx-win32-x64-msvc': 'nx.win32-x64-msvc.node',
      '@nx/nx-win32-ia32-msvc': 'nx.win32-ia32-msvc.node',
      '@nx/nx-win32-arm64-msvc': 'nx.win32-arm64-msvc.node',
      '@nx/nx-linux-x64-gnu': 'nx.linux-x64-gnu.node',
      '@nx/nx-linux-x64-musl': 'nx.linux-x64-musl.node',
      '@nx/nx-linux-arm64-gnu': 'nx.linux-arm64-gnu.node',
      '@nx/nx-linux-arm64-musl': 'nx.linux-arm64-musl.node',
      '@nx/nx-linux-arm-gnueabihf': 'nx.linux-arm-gnueabihf.node',
      '@nx/nx-linux-arm-musleabihf': 'nx.linux-arm-musleabihf.node',
      '@nx/nx-freebsd-x64': 'nx.freebsd-x64.node',
    };
    const localFile = localFiles[expectedPackage];
    if (localFile) {
      return existsSync(join(__dirname, localFile));
    }
    return false;
  }
}

/**
 * Throw an error with helpful instructions when native binary is missing.
 * This prevents the WASI fallback from hanging in CI environments.
 */
function throwMissingNativeBinaryError() {
  const expectedPackage = getExpectedNativePackage();
  const platform = process.platform;
  const arch = process.arch;

  const errorMessage = `
Nx could not find the native binary for your platform (${platform}-${arch}).

The expected package "${expectedPackage || 'unknown'}" is not installed.

This commonly happens in CI environments when optional dependencies are not installed.

To fix this issue, try one of the following:

1. Explicitly install the platform-specific package:
   npm install -D ${expectedPackage}
   # or
   yarn add -D ${expectedPackage}
   # or
   pnpm add -D ${expectedPackage}

2. If using npm, ensure optional dependencies are installed:
   npm install --include=optional

3. If you want to allow Nx to fall back to WebAssembly (may cause hangs in CI):
   Set the environment variable: NX_NATIVE_REQUIRE_ALLOW_FALLBACK=true

For more information, see: https://nx.dev/troubleshooting/troubleshoot-nx-install-issues
`.trim();

  throw new Error(errorMessage);
}

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

// Check if native binary is available before loading native-bindings.js
// This prevents the WASI fallback from hanging indefinitely in CI environments
// See: https://github.com/nrwl/nx/issues/32750
const allowWasiFallback =
  process.env.NX_NATIVE_REQUIRE_ALLOW_FALLBACK === 'true';
const forceWasi =
  process.env.NAPI_RS_FORCE_WASI === 'true' ||
  process.env.NAPI_RS_FORCE_WASI === '1';

if (!forceWasi && !canResolveNativeBinary()) {
  if (!allowWasiFallback) {
    Module._load = originalLoad;
    throwMissingNativeBinaryError();
  } else {
    // Warn that WASI fallback may hang
    const expectedPackage = getExpectedNativePackage();
    console.warn(
      `\nWarning: Nx native binary for ${process.platform}-${process.arch} not found.` +
        `\nFalling back to WebAssembly, which may hang in some environments.` +
        `\nTo fix this, install the platform-specific package: ${expectedPackage || 'unknown'}` +
        `\nSee: https://nx.dev/troubleshooting/troubleshoot-nx-install-issues\n`
    );
  }
}

const indexModulePath = require.resolve('./native-bindings.js');
delete require.cache[indexModulePath];
const indexModule = require('./native-bindings.js');

module.exports = indexModule;
Module._load = originalLoad;
