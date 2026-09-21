//! Whether a run uses I/O snapshots at all, and the inputs that decide it.
//! Separate from the fetch so the daemon handler, the overrides and the run
//! can ask without pulling in the Nx Cloud client.

import type { NxJsonConfiguration } from '../config/nx-json';
import { getLatestCommitSha } from '../utils/git-utils';
import { isNxCloudDisabled, isNxCloudUsed } from '../utils/nx-cloud-utils';

export interface IoSnapshotCloudOptions {
  accessToken?: string;
  nxCloudId?: string;
  url?: string;
  cloud?: boolean;
}

/**
 * The environment the decision is made in. The daemon has its own
 * `process.env`, older than this run, so the run's values travel with the
 * request instead.
 */
export interface IoSnapshotEnv {
  NX_IO_SNAPSHOTS?: string;
  NX_IO_SNAPSHOTS_MAX_AGE?: string;
}

/**
 * On whenever the workspace is connected to Nx Cloud; the server decides
 * whether anything comes back. `NX_IO_SNAPSHOTS=false` is the kill switch,
 * `NX_IO_SNAPSHOTS=true` forces it on for debugging.
 */
export function isIoSnapshotFetchEnabled(
  nxJson: NxJsonConfiguration,
  runnerOptions: IoSnapshotCloudOptions = {},
  env: IoSnapshotEnv = process.env
): boolean {
  // A disabled Cloud wins over everything, including the debug override.
  if (isNxCloudDisabled(nxJson) || runnerOptions.cloud === false) return false;
  const override = env.NX_IO_SNAPSHOTS;
  if (override === 'false') return false;
  return override === 'true' || isNxCloudUsed(nxJson);
}

/** The subset of this run's environment the decision and the max age read. */
export function ioSnapshotEnv(
  env: NodeJS.ProcessEnv = process.env
): IoSnapshotEnv {
  return {
    NX_IO_SNAPSHOTS: env.NX_IO_SNAPSHOTS,
    NX_IO_SNAPSHOTS_MAX_AGE: env.NX_IO_SNAPSHOTS_MAX_AGE,
  };
}

/** The commit whose stored set applies to this checkout; `null` outside a git repo. */
export function ioSnapshotCommitForHead(): string | null {
  return getLatestCommitSha() || null;
}
