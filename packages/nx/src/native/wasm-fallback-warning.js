// Keep in sync with the `nxPackages` set in ./index.js. A platform missing here is treated as
// WASM-only and stays silent, so an entry that drifts turns the warning off rather than breaking it.
const NATIVE_PACKAGES = {
  'android-arm': '@nx/nx-android-arm-eabi',
  'android-arm64': '@nx/nx-android-arm64',
  'darwin-arm64': '@nx/nx-darwin-arm64',
  'darwin-x64': '@nx/nx-darwin-x64',
  'freebsd-x64': '@nx/nx-freebsd-x64',
  'linux-arm': '@nx/nx-linux-arm-gnueabihf',
  'linux-arm64': '@nx/nx-linux-arm64-{libc}',
  'linux-x64': '@nx/nx-linux-x64-{libc}',
  'win32-arm64': '@nx/nx-win32-arm64-msvc',
  'win32-ia32': '@nx/nx-win32-ia32-msvc',
  'win32-x64': '@nx/nx-win32-x64-msvc',
};

function getExpectedNativePackage({ platform, arch, isMusl } = {}) {
  const template = NATIVE_PACKAGES[`${platform}-${arch}`];
  if (!template) {
    return null;
  }

  let libc;
  try {
    libc = isMusl() ? 'musl' : 'gnu';
  } catch (e) {
    libc = 'gnu';
  }
  return template.replace('{libc}', libc);
}

function getWasmFallbackWarning({
  platform,
  arch,
  isMusl,
  env = {},
  nativePackageResolvable,
} = {}) {
  if (
    env.NAPI_RS_FORCE_WASI ||
    env.NX_ALLOW_WASM_FALLBACK === 'true' ||
    env.NX_WASM_FALLBACK_WARNED === 'true'
  ) {
    return null;
  }

  // The package being resolvable means it installed fine and failed to load, which is normal in
  // WebContainers/StackBlitz. Only an unresolvable package is the broken install this warns about.
  if (nativePackageResolvable === true) {
    return null;
  }

  const pkg = getExpectedNativePackage({ platform, arch, isMusl });
  if (!pkg) {
    return null;
  }

  return [
    '',
    ' NX   Nx could not load its native binary and fell back to the WebAssembly runtime.',
    '',
    '  The WebAssembly runtime is much slower than the native binary and can look like a hang',
    '  on large workspaces.',
    '',
    `  This install is missing ${pkg}.`,
    '',
    '  The most common cause is a lockfile that lost its platform optionalDependencies, for',
    '  example one regenerated on a different operating system (npm/cli#4828) or resolved',
    '  after a merge conflict.',
    '',
    `  Recreate the lockfile so that ${pkg} is present, then reinstall.`,
    '',
    '  Set NX_ALLOW_WASM_FALLBACK=true to silence this warning.',
    '',
    '',
  ].join('\n');
}

module.exports = { getExpectedNativePackage, getWasmFallbackWarning };
