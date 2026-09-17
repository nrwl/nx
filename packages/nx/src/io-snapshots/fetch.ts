import type { NxJsonConfiguration } from '../config/nx-json';
import {
  importIoSnapshots,
  loadIoSnapshots,
  readIoSnapshotResolution,
  skippedIoSnapshots,
  type IoSnapshots,
} from '../native';
import { findAncestorNodeModules } from '../nx-cloud/resolution-helpers';
import { verifyOrUpdateNxCloudClient } from '../nx-cloud/update-manager';
import { getDbConnection } from '../utils/db-connection';
import { getLatestCommitSha } from '../utils/git-utils';
import { logger } from '../utils/logger';
import { isNxCloudDisabled, isNxCloudUsed } from '../utils/nx-cloud-utils';
import { output } from '../utils/output';
import { nxVersion } from '../utils/versions';
import { workspaceRoot } from '../utils/workspace-root';

export type { IoSnapshotResolution, IoSnapshots } from '../native';

/** A cached bundle younger than this is served without asking Nx Cloud. */
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000;
const READ_TIMEOUT_MS = 10_000;

export interface IoSnapshotCloudOptions {
  accessToken?: string;
  nxCloudId?: string;
  url?: string;
  cloud?: boolean;
}

/** The Nx Cloud client's `readIoSnapshots` contract, as far as nx uses it. */
/**
 * The environment the decision is made in. The daemon has its own
 * `process.env`, older than this run, so the run's values travel with the
 * request instead.
 */
export interface IoSnapshotEnv {
  NX_IO_SNAPSHOTS?: string;
  NX_IO_SNAPSHOTS_MAX_AGE?: string;
}

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

/**
 * The Cloud options a run would resolve, for callers that have nx.json but not
 * a task runner. Mirrors `getRunnerOptions`' precedence for these fields:
 * the default runner's own options first, then the top-level nx.json keys.
 */
export function ioSnapshotOptionsFromNxJson(
  nxJson: NxJsonConfiguration
): IoSnapshotCloudOptions {
  const runner = nxJson.tasksRunnerOptions?.default?.options ?? {};
  return {
    accessToken: runner.accessToken ?? nxJson.nxCloudAccessToken,
    nxCloudId: runner.nxCloudId ?? nxJson.nxCloudId,
    url: runner.url ?? nxJson.nxCloudUrl,
  };
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
  env: IoSnapshotEnv = process.env
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
  const maxAge = parseMaxAge(env.NX_IO_SNAPSHOTS_MAX_AGE) ?? DEFAULT_MAX_AGE_MS;
  if (cached && maxAge > 0 && Date.now() - cached.fetchedAt <= maxAge) {
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
    const reason = reasonFromError(e);
    if (cached) {
      const stale = loadIoSnapshots(db, head, 'stale-offline', errorMessage(e));
      if (stale.status !== 'skipped') {
        return reportIoSnapshotResolution(stale);
      }
    }
    return reportIoSnapshotResolution(
      skippedIoSnapshots(reason, errorMessage(e))
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

function parseMaxAge(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
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
