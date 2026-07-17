// TODO(v23): remove — kept only so `@nx/js@21`'s library generator can load via `ensurePackage`.
/** @deprecated Compat shim for `@nx/js@21`. */
export function shouldUseLegacyVersioning(releaseConfig: any): boolean {
  return releaseConfig?.version?.useLegacyVersioning ?? false;
}
