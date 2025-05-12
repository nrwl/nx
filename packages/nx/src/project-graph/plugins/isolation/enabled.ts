import { IS_WASM } from '../../../native';

export function isIsolationEnabled() {
  // Explicitly enabled, regardless of further conditions
  if (process.env.NX_ISOLATE_PLUGINS === 'true') {
    return true;
  }
  if (
    // Explicitly disabled
    process.env.NX_ISOLATE_PLUGINS === 'false' ||
    // Isolation is disabled on WASM builds currently.
    IS_WASM
  ) {
    return false;
  }
  // Default value
  return true;
}
