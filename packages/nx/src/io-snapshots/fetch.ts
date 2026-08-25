import { join } from 'path';
import type { NxJsonConfiguration } from '../config/nx-json';
import { fetchIoSnapshots, type IoSnapshots } from '../native';
import { cacheDir } from '../utils/cache-directory';
import { logger } from '../utils/logger';
import { isNxCloudUsed } from '../utils/nx-cloud-utils';
import { output } from '../utils/output';
import { nxVersion } from '../utils/versions';
import { workspaceRoot } from '../utils/workspace-root';

export type { IoSnapshotResolution, IoSnapshots } from '../native';
/** @deprecated use IoSnapshots */
export type IoSnapshotFetchResult = IoSnapshots;

/** Shared across worktrees: `cacheDir` resolves to the main worktree. */
export const ioSnapshotsCacheDirectory = join(cacheDir, 'io-snapshots');

export interface IoSnapshotCloudOptions {
  accessToken?: string;
  nxCloudId?: string;
  url?: string;
  cloud?: boolean;
}

/**
 * On whenever the workspace is connected to Nx Cloud; the server flag decides
 * whether anything comes back. `NX_IO_SNAPSHOTS=false` is the kill switch,
 * `NX_IO_SNAPSHOTS=true` forces it on for debugging.
 */
export function isIoSnapshotFetchEnabled(
  nxJson: NxJsonConfiguration,
  runnerOptions: IoSnapshotCloudOptions = {}
): boolean {
  const override = process.env.NX_IO_SNAPSHOTS;
  if (override === 'false') return false;
  if (runnerOptions.cloud === false) return false;
  return override === 'true' || isNxCloudUsed(nxJson);
}

// Reasons that indicate misconfiguration rather than an expected offline state.
const WARNED_REASONS = new Set([
  'unauthorized',
  'unsupported-server',
  'invalid-response',
  'write-failed',
]);

/**
 * Resolves the I/O snapshot bundle for HEAD once per run. Returns `null` when
 * snapshot fetching is not enabled for this workspace; never throws.
 */
export async function fetchIoSnapshotsForRun(
  nxJson: NxJsonConfiguration,
  runnerOptions: IoSnapshotCloudOptions
): Promise<IoSnapshots | null> {
  if (!isIoSnapshotFetchEnabled(nxJson, runnerOptions)) {
    return null;
  }

  const result = await fetchIoSnapshots({
    workspaceRoot,
    cacheDirectory: ioSnapshotsCacheDirectory,
    apiUrl:
      process.env.NX_CLOUD_API || runnerOptions.url || 'https://cloud.nx.app',
    accessToken: process.env.NX_CLOUD_ACCESS_TOKEN || runnerOptions.accessToken,
    nxCloudId: runnerOptions.nxCloudId,
    clientVersion: `nx/${nxVersion}`,
    maxAgeMs: parseMaxAge(process.env.NX_IO_SNAPSHOTS_MAX_AGE),
  });
  report(result);
  return result;
}

function parseMaxAge(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function report(result: IoSnapshots): void {
  if (result.status === 'skipped') {
    if (WARNED_REASONS.has(result.reason)) {
      output.warn({
        title: `Nx Cloud I/O snapshots are unavailable (${result.reason})`,
        bodyLines: [result.message, 'Tasks will be hashed without them.'],
      });
    } else {
      logger.verbose(
        `Skipping Nx Cloud I/O snapshots (${result.reason}): ${result.message}`
      );
    }
    return;
  }
  const { resolution } = result;
  logger.verbose(
    `Nx Cloud I/O snapshots ${result.status}${
      result.reason ? ` (${result.reason})` : ''
    }: ${resolution.tasks} tasks for ${resolution.requestedCommit.slice(
      0,
      12
    )} from ${resolution.sourceCommits.length} commit(s), digest ${
      resolution.digest
    }`
  );
}
