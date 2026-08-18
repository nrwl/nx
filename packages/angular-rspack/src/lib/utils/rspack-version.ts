export function isRspackV2(): boolean {
  // Lazy-require avoids loading @rspack/core (pure ESM in v2) at module load
  // time; these call sites run at config-build time, before a compiler exists.
  const { rspackVersion } =
    require('@rspack/core') as typeof import('@rspack/core');
  return parseInt(rspackVersion ?? '1', 10) >= 2;
}
