import type { NxJsonConfiguration } from '../config/nx-json';
import { IoSnapshotStore } from '../native';
import { findAncestorNodeModules } from '../nx-cloud/resolution-helpers';
import {
  ioSnapshotEnv,
  isIoSnapshotFetchEnabled,
  type IoSnapshotCloudOptions,
  type IoSnapshotEnv,
} from './config';
import {
  errorMessage,
  reasonFromError,
  skippedIoSnapshots,
  storedIoSnapshots,
  type IoSnapshotOutcome,
} from './outcome';
import { verifyOrUpdateNxCloudClient } from '../nx-cloud/update-manager';
import { getDbConnection } from '../utils/db-connection';
import { getLatestCommitSha } from '../utils/git-utils';
import { logger } from '../utils/logger';
import { output } from '../utils/output';
import { nxVersion } from '../utils/versions';
import { workspaceRoot } from '../utils/workspace-root';

export type { IoSnapshotResolution, IoSnapshots } from '../native';
export type { IoSnapshotOutcome } from './outcome';

/**
 * A stored set younger than this is served without asking Nx Cloud, so the
 * several commands of one CI job share one fetch. Past it the run asks again,
 * since Nx Cloud resolves HEAD from its nearest recorded ancestors and a
 * closer recording can appear for the same commit later.
 */
const STORED_SET_MAX_AGE_MS = 60 * 60 * 1000;
const READ_TIMEOUT_MS = 10_000;

/** The Nx Cloud client's `readIoSnapshots` contract, as far as nx uses it. */
export interface ReadIoSnapshotsOptions {
  workspaceRoot?: string;
  nxCloudOptions?: IoSnapshotCloudOptions;
  /** The `updatedAt` of the set the caller holds; an unchanged set resolves to `null`. */
  knownUpdatedAt?: number;
  timeoutMs?: number;
}

export interface ReadIoSnapshot {
  commit: string;
  inputs: readonly string[];
  outputs: readonly string[];
}

export interface ReadIoSnapshotsResult {
  /** Newest first; index 0 is HEAD. */
  commits: string[];
  updatedAt: number;
  snapshots: Readonly<Record<string, ReadIoSnapshot>>;
}

// Reasons that indicate misconfiguration rather than an expected offline
// state or a client that simply predates snapshots.
const WARNED_REASONS = new Set([
  'unauthorized',
  'invalid-response',
  'write-failed',
]);

/**
 * Resolves the I/O snapshot set for HEAD once per run: the stored set while
 * it is fresh, otherwise what the Nx Cloud client reads for HEAD's commit
 * graph, imported into the store. Returns `null` when snapshots are not
 * enabled for this workspace; never throws.
 */
export async function fetchIoSnapshotsForRun(
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
  const store = new IoSnapshotStore(getDbConnection());
  const stored = storedIoSnapshots(store, head);
  const storedSet = stored.status === 'skipped' ? null : stored.snapshots;
  if (
    storedSet &&
    Date.now() - storedSet.resolution.fetchedAt <= STORED_SET_MAX_AGE_MS
  ) {
    return reportIoSnapshotResolution(stored);
  }

  let read: NonNullable<
    Awaited<ReturnType<typeof loadCloudClient>>['readIoSnapshots']
  >;
  try {
    const client = await loadCloudClient(runnerOptions);
    if (typeof client.readIoSnapshots !== 'function') {
      return reportIoSnapshotResolution(
        skippedIoSnapshots(
          'unsupported-client',
          'The installed Nx Cloud client does not expose I/O snapshots; update nx-cloud'
        )
      );
    }
    read = client.readIoSnapshots;
  } catch (e) {
    return reportIoSnapshotResolution(
      skippedIoSnapshots('no-cloud-client', errorMessage(e))
    );
  }

  try {
    const result = await read({
      workspaceRoot,
      nxCloudOptions: runnerOptions,
      knownUpdatedAt: storedSet?.resolution.updatedAt ?? undefined,
      timeoutMs: READ_TIMEOUT_MS,
    });
    if (result === null) {
      // Unchanged since the stored set, which is still current.
      return reportIoSnapshotResolution(stored);
    }
    return reportIoSnapshotResolution({
      status: 'fetched',
      snapshots: store.import({
        requestedCommit: head,
        commits: result.commits,
        snapshotsJson: JSON.stringify(result.snapshots),
        updatedAt: result.updatedAt,
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

async function loadCloudClient(runnerOptions: IoSnapshotCloudOptions) {
  const { nxCloudClient } = await verifyOrUpdateNxCloudClient(runnerOptions);
  nxCloudClient.configureLightClientRequire()(
    findAncestorNodeModules(__dirname, [])
  );
  return nxCloudClient;
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
    )} from ${resolution.sourceCommits.length} commit(s), digest ${resolution.digest}`
  );
  return outcome;
}
