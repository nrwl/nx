import type { NxJsonConfiguration } from '../config/nx-json';
import { IoSnapshotStore, type IoSnapshots } from '../native';
import { getDbConnection } from '../utils/db-connection';
import { getLatestCommitSha } from '../utils/git-utils';
import { logger } from '../utils/logger';
import { output } from '../utils/output';
import { nxVersion } from '../utils/versions';
import {
  ioSnapshotEnv,
  isIoSnapshotFetchEnabled,
  type IoSnapshotCloudOptions,
  type IoSnapshotEnv,
} from './config';
import { fetchIoSnapshots } from './fetch';

/** What resolving this run's snapshot set came to. Only a set that resolved carries one. */
export type IoSnapshotOutcome =
  | { status: 'fetched' | 'cached'; snapshots: IoSnapshots }
  | { status: 'skipped'; reason: string; message: string };

export function skippedIoSnapshots(
  reason: string,
  message: string
): IoSnapshotOutcome {
  return { status: 'skipped', reason, message };
}

/** The set an outcome resolved to, if any. */
export function snapshotsOf(
  outcome: IoSnapshotOutcome | null
): IoSnapshots | undefined {
  return outcome && outcome.status !== 'skipped'
    ? outcome.snapshots
    : undefined;
}

/**
 * Younger sets are served without asking Nx Cloud; older ones re-fetch, since
 * a closer ancestor's recording may have landed.
 */
const STORED_SET_MAX_AGE_MS = 60 * 60 * 1000;

// Reasons that indicate misconfiguration rather than an expected offline
// state or a client that simply predates snapshots.
const WARNED_REASONS = new Set([
  'unauthorized',
  'invalid-response',
  'write-failed',
]);

/** The snapshot store in this process's workspace database. */
export function getIoSnapshotStore(): IoSnapshotStore {
  return new IoSnapshotStore(getDbConnection());
}

/**
 * This run's I/O snapshot set for HEAD, in the process that owns the fetch:
 * the stored set while it is fresh, otherwise what Nx Cloud reads, imported
 * into the store. Returns `null` when snapshots are not enabled for this
 * workspace; never throws.
 */
export async function loadIoSnapshotsForRun(
  nxJson: NxJsonConfiguration,
  runnerOptions: IoSnapshotCloudOptions,
  env: IoSnapshotEnv = ioSnapshotEnv()
): Promise<IoSnapshotOutcome | null> {
  if (!isIoSnapshotFetchEnabled(nxJson, runnerOptions, env)) {
    return null;
  }
  const head = getLatestCommitSha();
  if (!head) {
    return reportIoSnapshotResolution(
      skippedIoSnapshots('not-a-git-repo', 'Could not resolve HEAD')
    );
  }
  const store = getIoSnapshotStore();
  const stored = store.get(head, STORED_SET_MAX_AGE_MS);
  if (stored) {
    return reportIoSnapshotResolution({ status: 'cached', snapshots: stored });
  }

  try {
    const result = await fetchIoSnapshots(runnerOptions);
    return reportIoSnapshotResolution({
      status: 'fetched',
      snapshots: store.import({
        requestedCommit: head,
        commits: result.commits,
        snapshotsJson: JSON.stringify(result.snapshots),
        clientVersion: `nx/${nxVersion}`,
      }),
    });
  } catch (e) {
    // No fallback to an older set for this commit: it would hash from a
    // recording the run could not refresh, and CI can hash natively instead.
    return reportIoSnapshotResolution(
      skippedIoSnapshots(reasonFromError(e), errorMessage(e))
    );
  }
}

const OFFLINE_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
]);

/** A skip reason from an error's `code`: from the Nx Cloud read or the store. */
function reasonFromError(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  if (typeof code !== 'string') return 'fetch-failed';
  if (OFFLINE_CODES.has(code)) return 'offline';
  return code.toLowerCase().replace(/_/g, '-');
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Warns or logs what a resolution came to; also used by the daemon path. */
export function reportIoSnapshotResolution(
  outcome: IoSnapshotOutcome
): IoSnapshotOutcome {
  if (outcome.status === 'skipped') {
    if (WARNED_REASONS.has(outcome.reason)) {
      output.warn({
        title: `Nx Cloud I/O snapshots are unavailable (${outcome.reason})`,
        bodyLines: [outcome.message, 'Tasks will be hashed without them.'],
      });
    } else {
      logger.verbose(
        `Skipping Nx Cloud I/O snapshots (${outcome.reason}): ${outcome.message}`
      );
    }
    return outcome;
  }
  const { resolution } = outcome.snapshots;
  logger.verbose(
    `Nx Cloud I/O snapshots ${outcome.status}: ${resolution.tasks} tasks for ${resolution.requestedCommit.slice(
      0,
      12
    )} from ${resolution.sourceCommits.length} commit(s)`
  );
  return outcome;
}
