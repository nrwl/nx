import type { NxJsonConfiguration } from '../config/nx-json';

/**
 * Analytics are opt-in: both `"analytics": false` and an unset flag mean no
 * event is ever sent. Anything enabled for the sake of analytics (network
 * allowlists, endpoints) gates on this, not on an explicit opt-out alone.
 */
export function isAnalyticsEnabled(
  nxJson: NxJsonConfiguration | null
): boolean {
  return nxJson?.analytics === true;
}
