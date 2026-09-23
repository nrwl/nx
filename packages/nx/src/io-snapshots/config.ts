import type { NxJsonConfiguration } from '../config/nx-json';
import { isNxCloudDisabled } from '../utils/nx-cloud-utils';

export interface IoSnapshotCloudOptions {
  accessToken?: string;
  nxCloudId?: string;
  url?: string;
  cloud?: boolean;
}

export interface IoSnapshotEnv {
  NX_IO_SNAPSHOTS?: string;
}

/**
 * Off unless a run opts in with `NX_IO_SNAPSHOTS=true`, so a workspace
 * connected to Nx Cloud is unaffected until it asks. A disabled Cloud wins
 * over the opt-in, since there is nothing to fetch from.
 */
export function isIoSnapshotFetchEnabled(
  nxJson: NxJsonConfiguration,
  runnerOptions: IoSnapshotCloudOptions = {},
  env: IoSnapshotEnv = ioSnapshotEnv()
): boolean {
  if (isNxCloudDisabled(nxJson) || runnerOptions.cloud === false) return false;
  return env.NX_IO_SNAPSHOTS === 'true';
}

/** The subset of this run's environment the decision reads. */
export function ioSnapshotEnv(
  env: NodeJS.ProcessEnv = process.env
): IoSnapshotEnv {
  return {
    NX_IO_SNAPSHOTS: env.NX_IO_SNAPSHOTS,
  };
}
