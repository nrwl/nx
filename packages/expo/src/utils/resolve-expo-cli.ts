/**
 * Resolve the path to the Expo CLI entry point.
 *
 * Expo SDK 55+ ships `@expo/cli` with an `exports` map where subpaths resolve
 * to `*.js` (`"./*": "./*.js"`). The CLI bin file is `build/bin/cli` (with no
 * extension), so `require.resolve('@expo/cli/build/bin/cli')` now fails with
 * MODULE_NOT_FOUND. The `expo` package's `bin/cli` is the stable entry point
 * (the same one `npx expo` uses) across all supported SDK versions, so prefer
 * it and fall back to the legacy `@expo/cli` path for older setups.
 */
export function resolveExpoCliPath(): string {
  try {
    return require.resolve('expo/bin/cli');
  } catch {
    return require.resolve('@expo/cli/build/bin/cli');
  }
}
