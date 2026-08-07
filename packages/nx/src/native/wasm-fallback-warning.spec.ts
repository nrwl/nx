const {
  getExpectedNativePackage,
  getWasmFallbackWarning,
} = require('./wasm-fallback-warning');

const gnu = () => false;
const musl = () => true;

const brokenInstall = (overrides: Record<string, unknown> = {}) => ({
  platform: 'linux',
  arch: 'x64',
  isMusl: gnu,
  env: {},
  nativePackageResolvable: false,
  ...overrides,
});

describe('getExpectedNativePackage', () => {
  it('names the gnu package on linux x64', () => {
    expect(
      getExpectedNativePackage({ platform: 'linux', arch: 'x64', isMusl: gnu })
    ).toBe('@nx/nx-linux-x64-gnu');
  });

  it('names the musl package on linux x64 with musl libc', () => {
    expect(
      getExpectedNativePackage({ platform: 'linux', arch: 'x64', isMusl: musl })
    ).toBe('@nx/nx-linux-x64-musl');
  });

  it('names the darwin arm64 package', () => {
    expect(
      getExpectedNativePackage({
        platform: 'darwin',
        arch: 'arm64',
        isMusl: gnu,
      })
    ).toBe('@nx/nx-darwin-arm64');
  });

  it('ignores libc where only one variant is published', () => {
    expect(
      getExpectedNativePackage({ platform: 'linux', arch: 'arm', isMusl: musl })
    ).toBe('@nx/nx-linux-arm-gnueabihf');
  });

  it('falls back to the gnu package when libc detection throws', () => {
    expect(
      getExpectedNativePackage({
        platform: 'linux',
        arch: 'x64',
        isMusl: () => {
          throw new Error('ldd is not available');
        },
      })
    ).toBe('@nx/nx-linux-x64-gnu');
  });

  it('returns null on platforms that have no prebuilt native package', () => {
    expect(
      getExpectedNativePackage({ platform: 'sunos', arch: 'x64', isMusl: gnu })
    ).toBeNull();
  });
});

describe('getWasmFallbackWarning', () => {
  it('warns when the expected package cannot be resolved', () => {
    const warning = getWasmFallbackWarning(brokenInstall());

    expect(warning).toContain('@nx/nx-linux-x64-gnu');
    expect(warning).toContain('WebAssembly');
    expect(warning).toContain('optionalDependencies');
    expect(warning).toContain('NX_ALLOW_WASM_FALLBACK=true');
  });

  it('names the musl package when the install is musl based', () => {
    expect(getWasmFallbackWarning(brokenInstall({ isMusl: musl }))).toContain(
      '@nx/nx-linux-x64-musl'
    );
  });

  // WebContainers/StackBlitz report linux/x64 and install @nx/nx-linux-x64-gnu normally, but
  // dlopen fails, so nx legitimately runs WASM. That is not a broken install.
  it('stays quiet when the expected package resolves but the binary will not load', () => {
    expect(
      getWasmFallbackWarning(brokenInstall({ nativePackageResolvable: true }))
    ).toBeNull();
  });

  it('stays quiet on platforms that have no prebuilt native package', () => {
    expect(
      getWasmFallbackWarning(brokenInstall({ platform: 'sunos' }))
    ).toBeNull();
  });

  it.each([
    ['NAPI_RS_FORCE_WASI', '1'],
    ['NX_ALLOW_WASM_FALLBACK', 'true'],
    ['NX_WASM_FALLBACK_WARNED', 'true'],
  ])('stays quiet when %s is set', (name, value) => {
    expect(
      getWasmFallbackWarning(brokenInstall({ env: { [name]: value } }))
    ).toBeNull();
  });
});
