//! Whether a run uses I/O snapshots at all, and the inputs that decide it.
//! Separate from the fetch so the daemon handler, the overrides and the run
//! can ask without pulling in the Nx Cloud client.

import type { NxJsonConfiguration } from '../config/nx-json';
import { getLatestCommitSha } from '../utils/git-utils';
import { isNxCloudDisabled } from '../utils/nx-cloud-utils';

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
 * Off unless a run opts in with `NX_IO_SNAPSHOTS=true`, so a workspace
 * connected to Nx Cloud is unaffected until it asks. A disabled Cloud wins
 * over the opt-in, since there is nothing to fetch from.
 *
 * Meant for CI: a recording is taken at a commit, so a working tree with
 * uncommitted edits can read files no recording accounts for.
 */
export function isIoSnapshotFetchEnabled(
  nxJson: NxJsonConfiguration,
  runnerOptions: IoSnapshotCloudOptions = {},
  env: IoSnapshotEnv = ioSnapshotEnv()
): boolean {
  if (isNxCloudDisabled(nxJson) || runnerOptions.cloud === false) return false;
  return env.NX_IO_SNAPSHOTS === 'true';
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
