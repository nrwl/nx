// Mock for `@nx/devkit/internal`. Mirrors the `@nx/devkit` mock pattern: only
// the symbols the plugin code imports are provided, and behavior is the
// minimum each test path needs.
//
// `assertSupportedInstalledPackageVersion` is a no-op here because no current
// test exercises the runtime floor guard. In production, the helper would
// read the installed version via `getInstalledPackageVersion` and throw when
// below floor; making the mock a no-op lets tests transitively load the
// guard without depending on a built devkit/nx dist.

export function assertSupportedInstalledPackageVersion(
  _packageName: string,
  _minSupportedVersion: string
): void {
  /* no-op */
}
