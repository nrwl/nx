import type { NxJsonConfiguration } from '../config/nx-json';
import { isCI } from '../utils/is-ci';
import { isNxCloudConfigured } from '../utils/nx-cloud-utils';

export interface IoSnapshotCloudOptions {
  accessToken?: string;
  nxCloudId?: string;
  url?: string;
  cloud?: boolean;
}

export interface IoSnapshotEnv {
  NX_IO_SNAPSHOTS?: string;
  NX_CLOUD_USE_IO_SNAPSHOTS?: string;
  NX_NO_CLOUD?: string;
  /** Whether the run's env holds an Nx Cloud token. */
  hasNxCloudToken?: boolean;
}

/**
 * Off unless a CI run opts in with `NX_IO_SNAPSHOTS=true`, or the Nx Cloud
 * client's `NX_CLOUD_USE_IO_SNAPSHOTS=true`, in a workspace that uses Nx Cloud,
 * since there is nothing to fetch from otherwise. `env` defaults to this
 * process's.
 */
export function isIoSnapshotFetchEnabled(
  nxJson: NxJsonConfiguration,
  runnerOptions: IoSnapshotCloudOptions = {},
  env: IoSnapshotEnv = ioSnapshotEnv()
): boolean {
  if (
    env.NX_NO_CLOUD === 'true' ||
    nxJson.neverConnectToCloud ||
    runnerOptions.cloud === false ||
    (env.NX_IO_SNAPSHOTS !== 'true' &&
      env.NX_CLOUD_USE_IO_SNAPSHOTS !== 'true') ||
    !isCI()
  ) {
    return false;
  }
  return !!env.hasNxCloudToken || isNxCloudConfigured(nxJson);
}

/** The subset of this run's environment the decision reads. */
export function ioSnapshotEnv(
  env: NodeJS.ProcessEnv = process.env
): IoSnapshotEnv {
  return {
    NX_IO_SNAPSHOTS: env.NX_IO_SNAPSHOTS,
    NX_CLOUD_USE_IO_SNAPSHOTS: env.NX_CLOUD_USE_IO_SNAPSHOTS,
    NX_NO_CLOUD: env.NX_NO_CLOUD,
    hasNxCloudToken: !!(env.NX_CLOUD_ACCESS_TOKEN || env.NX_CLOUD_AUTH_TOKEN),
  };
}
