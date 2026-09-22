import type { NxJsonConfiguration } from '../config/nx-json';
import type { IoSnapshots } from '../native';
import { findAncestorNodeModules } from '../nx-cloud/resolution-helpers';
import {
  ioSnapshotEnv,
  isIoSnapshotFetchEnabled,
  type IoSnapshotCloudOptions,
  type IoSnapshotEnv,
} from './config';
import { getIoSnapshotStore } from './store';
import {
  verifyOrUpdateNxCloudClient,
  type NxCloudClient,
} from '../nx-cloud/update-manager';
import { getLatestCommitSha } from '../utils/git-utils';
import { logger } from '../utils/logger';
import { output } from '../utils/output';
import { nxVersion } from '../utils/versions';
import { workspaceRoot } from '../utils/workspace-root';

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
  const store = getIoSnapshotStore();
  const stored = store.get(head, STORED_SET_MAX_AGE_MS);
  if (stored) {
    return reportIoSnapshotResolution({ status: 'cached', snapshots: stored });
  }

  const read = await loadReadIoSnapshots(runnerOptions);
  if (typeof read !== 'function') {
    return reportIoSnapshotResolution(read);
  }

  try {
    const result = await read({
      workspaceRoot,
      nxCloudOptions: runnerOptions,
      timeoutMs: READ_TIMEOUT_MS,
    });
    if (!result) {
      // `null` only answers a `knownUpdatedAt` this run never sends.
      return reportIoSnapshotResolution(
        skippedIoSnapshots(
          'invalid-response',
          'Nx Cloud returned no I/O snapshot set'
        )
      );
    }
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

/** A skip reason from an error's `code`: the Nx Cloud client's or the store's. */
function reasonFromError(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  if (typeof code !== 'string') return 'fetch-failed';
  if (OFFLINE_CODES.has(code)) return 'offline';
  return code.toLowerCase().replace(/_/g, '-');
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The Nx Cloud client's snapshot read, or the skip that says why there is none. */
async function loadReadIoSnapshots(
  runnerOptions: IoSnapshotCloudOptions
): Promise<NonNullable<NxCloudClient['readIoSnapshots']> | IoSnapshotOutcome> {
  try {
    const client = (await verifyOrUpdateNxCloudClient(runnerOptions))
      ?.nxCloudClient;
    if (!client) {
      return skippedIoSnapshots(
        'no-cloud-client',
        'The Nx Cloud client could not be loaded'
      );
    }
    if (typeof client.readIoSnapshots !== 'function') {
      return skippedIoSnapshots(
        'unsupported-client',
        'The installed Nx Cloud client does not expose I/O snapshots; update nx-cloud'
      );
    }
    client.configureLightClientRequire()(
      findAncestorNodeModules(__dirname, [])
    );
    return client.readIoSnapshots;
  } catch (e) {
    return skippedIoSnapshots('no-cloud-client', errorMessage(e));
  }
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
