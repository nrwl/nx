import type { NxJsonConfiguration } from '../../../config/nx-json';

// TODO(v22): remove this function and entire concept of legacy versioning in v22
export function shouldUseLegacyVersioning(
  releaseConfig: NxJsonConfiguration['release'] | undefined
) {
  return process.env.NX_INTERNAL_USE_LEGACY_VERSIONING === 'true'
    ? true
    : releaseConfig?.version?.useLegacyVersioning ?? false;
}
