const { getWasmFallbackWarning } = require('./wasm-fallback-warning');

const gnu = () => false;
const musl = () => true;

describe('getWasmFallbackWarning', () => {
  it('names the gnu package on linux x64', () => {
    const warning = getWasmFallbackWarning({
      platform: 'linux',
      arch: 'x64',
      isMusl: gnu,
      env: {},
    });

    expect(warning).toContain('@nx/nx-linux-x64-gnu');
  });

  it('names the musl package on linux x64 with musl libc', () => {
    const warning = getWasmFallbackWarning({
      platform: 'linux',
      arch: 'x64',
      isMusl: musl,
      env: {},
    });

    expect(warning).toContain('@nx/nx-linux-x64-musl');
  });

  it('names the darwin arm64 package', () => {
    const warning = getWasmFallbackWarning({
      platform: 'darwin',
      arch: 'arm64',
      isMusl: gnu,
      env: {},
    });

    expect(warning).toContain('@nx/nx-darwin-arm64');
  });

  it('falls back to the gnu package when libc detection throws', () => {
    const warning = getWasmFallbackWarning({
      platform: 'linux',
      arch: 'x64',
      isMusl: () => {
        throw new Error('ldd is not available');
      },
      env: {},
    });

    expect(warning).toContain('@nx/nx-linux-x64-gnu');
  });

  it('stays quiet on platforms that have no prebuilt native package', () => {
    expect(
      getWasmFallbackWarning({
        platform: 'sunos',
        arch: 'x64',
        isMusl: gnu,
        env: {},
      })
    ).toBeNull();
  });

  it.each([
    ['NAPI_RS_FORCE_WASI', '1'],
    ['NX_ALLOW_WASM_FALLBACK', 'true'],
    ['NX_WASM_FALLBACK_WARNED', 'true'],
  ])('stays quiet when %s is set', (name, value) => {
    expect(
      getWasmFallbackWarning({
        platform: 'linux',
        arch: 'x64',
        isMusl: gnu,
        env: { [name]: value },
      })
    ).toBeNull();
  });

  it('explains the cause and the escape hatch', () => {
    const warning = getWasmFallbackWarning({
      platform: 'linux',
      arch: 'x64',
      isMusl: gnu,
      env: {},
    });

    expect(warning).toContain('WebAssembly');
    expect(warning).toContain('optionalDependencies');
    expect(warning).toContain('NX_ALLOW_WASM_FALLBACK=true');
  });
});
