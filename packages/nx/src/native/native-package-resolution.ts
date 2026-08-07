import { readFileSync } from 'fs';

// require rather than import: the helper is plain CommonJS and is not part of this project's ts file list.
const { getExpectedNativePackage } = require('./wasm-fallback-warning');

// Mirrors the musl detection in the generated native-bindings.js, which does not export it.
export function isMusl(): boolean {
  if (process.platform !== 'linux') {
    return false;
  }
  try {
    return readFileSync('/usr/bin/ldd', 'utf-8').includes('musl');
  } catch (e) {
    (process.report as any).excludeNetwork = true;
    return !(process.report.getReport() as any).header.glibcVersionRuntime;
  }
}

function canResolve(request: string): boolean {
  try {
    require.resolve(request);
    return true;
  } catch (e) {
    // Anything other than a missing module means the binary is installed but will not load, which
    // is normal in WebContainers. Treat it as present so only a genuinely absent package is flagged.
    return e?.code !== 'MODULE_NOT_FOUND';
  }
}

/**
 * The native package this platform expects, but only when it cannot be resolved at all.
 * Returns null when the package is installed, or when the platform ships no prebuilt binary.
 */
export function getMissingNativePackage(): string | null {
  const expected = getExpectedNativePackage({
    platform: process.platform,
    arch: process.arch,
    isMusl,
  });
  if (!expected) {
    return null;
  }
  // native-bindings.js accepts either the npm package or a binary built into this directory.
  const localBinary = `./nx.${expected.slice('@nx/nx-'.length)}.node`;
  return canResolve(expected) || canResolve(localBinary) ? null : expected;
}
