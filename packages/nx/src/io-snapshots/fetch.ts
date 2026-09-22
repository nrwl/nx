import type { NxJsonConfiguration } from '../config/nx-json';
import {
  importIoSnapshots,
  loadIoSnapshots,
  readIoSnapshotResolution,
  skippedIoSnapshots,
  type IoSnapshots,
} from '../native';
import { findAncestorNodeModules } from '../nx-cloud/resolution-helpers';
import {
  ioSnapshotEnv,
  isIoSnapshotFetchEnabled,
  type IoSnapshotCloudOptions,
  type IoSnapshotEnv,
} from './config';
import { verifyOrUpdateNxCloudClient } from '../nx-cloud/update-manager';
import { getDbConnection } from '../utils/db-connection';
import { getLatestCommitSha } from '../utils/git-utils';
import { logger } from '../utils/logger';
import { output } from '../utils/output';
import { nxVersion } from '../utils/versions';
import { workspaceRoot } from '../utils/workspace-root';

export type { IoSnapshotResolution, IoSnapshots } from '../native';

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
 * Resolves the I/O snapshot bundle for HEAD once per run: the cached bundle
 * while it is fresh, otherwise what the Nx Cloud client reads for HEAD's
 * commit graph, stored through the native store. Returns `null` when
 * snapshots are not enabled for this workspace; never throws.
 */
export async function fetchIoSnapshotsForRun(
  nxJson: NxJsonConfiguration,
  runnerOptions: IoSnapshotCloudOptions,
  env: IoSnapshotEnv = ioSnapshotEnv()
): Promise<IoSnapshots | null> {
  if (!isIoSnapshotFetchEnabled(nxJson, runnerOptions, env)) {
    return null;
  }
  const head = getLatestCommitSha();
  if (!head) {
    return reportIoSnapshotResolution(
      skippedIoSnapshots('not-a-git-repo', 'Could not resolve HEAD')
    );
  }
  const db = getDbConnection();
  const cached = readIoSnapshotResolution(db, head);
  if (cached && Date.now() - cached.fetchedAt <= STORED_SET_MAX_AGE_MS) {
    const fresh = loadIoSnapshots(db, head);
    if (fresh.status !== 'skipped') {
      return reportIoSnapshotResolution(fresh);
    }
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
      knownUpdatedAt: cached?.updatedAt ?? undefined,
      timeoutMs: READ_TIMEOUT_MS,
    });
    if (result === null) {
      // Unchanged since the cached set: the bundle on disk is still current.
      return reportIoSnapshotResolution(loadIoSnapshots(db, head));
    }
    return reportIoSnapshotResolution(
      importIoSnapshots(db, {
        requestedCommit: head,
        commits: result.commits,
        snapshotsJson: JSON.stringify(result.snapshots),
        updatedAt: result.updatedAt,
        clientVersion: `nx/${nxVersion}`,
      })
    );
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

const OFFLINE_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
]);

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
export function reportIoSnapshotResolution(result: IoSnapshots): IoSnapshots {
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
    return result;
  }
  const { resolution } = result;
  logger.verbose(
    `Nx Cloud I/O snapshots ${result.status}${
      result.reason ? ` (${result.reason})` : ''
    }: ${resolution.tasks} tasks for ${resolution.requestedCommit.slice(
      0,
      12
    )} from ${resolution.sourceCommits.length} commit(s), digest ${resolution.digest}`
  );
  return result;
}
