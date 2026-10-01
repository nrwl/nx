import { join } from 'path';
import type { NxJsonConfiguration } from '../config/nx-json';
import {
  FileLock,
  UltracacheConfigurationStore,
  IS_WASM,
  type UltracacheConfiguration,
} from '../native';
import {
  getDbConnection,
  sharedWorkspaceDataDirectory,
} from '../utils/db-connection';
import { getLatestCommitSha } from '../utils/git-utils';
import { logger } from '../utils/logger';
import { output } from '../utils/output';
import { workspaceRoot } from '../utils/workspace-root';
import {
  ultracacheEnv,
  isUltracacheConfigurationFetchEnabled,
  type UltracacheCloudOptions,
  type UltracacheEnv,
} from './config';
import {
  fetchUltracacheConfiguration,
  type ReadUltracacheConfigurationResult,
} from './fetch';

/** What resolving this run's snapshot set came to. Only a set that resolved carries one. */
export type UltracacheConfigurationOutcome =
  | { status: 'fetched' | 'cached'; snapshots: UltracacheConfiguration }
  | { status: 'skipped'; reason: string; message: string };

export function skippedUltracacheConfiguration(
  reason: string,
  message: string
): UltracacheConfigurationOutcome {
  return { status: 'skipped', reason, message };
}

/** The set an outcome resolved to, if any. */
export function snapshotsOf(
  outcome: UltracacheConfigurationOutcome | null
): UltracacheConfiguration | undefined {
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
export function getUltracacheConfigurationStore(): UltracacheConfigurationStore {
  return new UltracacheConfigurationStore(getDbConnection());
}

/**
 * Stores a set the Nx Cloud client read for `requestedCommit` and returns its
 * handle, for `runDiscreteTasks` and `runContinuousTasks`. Exposed to the
 * client through `nx/nx-cloud-internals`. Throws with the store's `code`.
 */
export function importUltracacheConfiguration(
  requestedCommit: string,
  snapshots: ReadUltracacheConfigurationResult['snapshots']
): UltracacheConfiguration {
  return getUltracacheConfigurationStore().import({
    requestedCommit,
    snapshotsJson: JSON.stringify(snapshots),
  });
}

/**
 * The stored version `importUltracacheConfiguration` returned, reopened by its commit and
 * `resolution.fetchedAt`, so other processes hash from it without importing
 * it again. `null` when it isn't stored. Exposed through `nx/nx-cloud-internals`.
 */
export function openUltracacheConfiguration(
  commit: string,
  fetchedAt: number
): UltracacheConfiguration | null {
  return getUltracacheConfigurationStore().getVersion(commit, fetchedAt);
}

/**
 * This run's I/O snapshot set for HEAD, in the process that owns the fetch:
 * the stored set while it is fresh, otherwise what Nx Cloud reads, imported
 * into the store. Returns `null` when snapshots are not enabled for this
 * workspace; never throws.
 */
export async function loadUltracacheConfigurationForRun(
  nxJson: NxJsonConfiguration,
  runnerOptions: UltracacheCloudOptions,
  env: UltracacheEnv = ultracacheEnv()
): Promise<UltracacheConfigurationOutcome | null> {
  if (!isUltracacheConfigurationFetchEnabled(nxJson, runnerOptions, env)) {
    return null;
  }
  const head = getLatestCommitSha();
  if (!head) {
    return reportUltracacheConfigurationResolution(
      skippedUltracacheConfiguration('not-a-git-repo', 'Could not resolve HEAD')
    );
  }
  try {
    const store = getUltracacheConfigurationStore();
    const cached = () => {
      const stored = store.get(head, STORED_SET_MAX_AGE_MS);
      return (
        stored &&
        reportUltracacheConfigurationResolution({
          status: 'cached',
          snapshots: stored,
        })
      );
    };
    return (
      cached() ??
      // Processes that miss together fetch once: the rest find its set.
      (await withUltracacheConfigurationFetchLock(async () => {
        const stored = cached();
        if (stored) {
          return stored;
        }
        const result = await fetchUltracacheConfiguration(runnerOptions);
        return reportUltracacheConfigurationResolution({
          status: 'fetched',
          snapshots: store.import({
            requestedCommit: head,
            snapshotsJson: JSON.stringify(result.snapshots),
          }),
        });
      }))
    );
  } catch (e) {
    // No fallback to an older set for this commit: it would hash from a
    // recording the run could not refresh, and CI can hash natively instead.
    return reportUltracacheConfigurationResolution(
      skippedUltracacheConfiguration(reasonFromError(e), errorMessage(e))
    );
  }
}

/** Runs `fetch` holding a lock beside the workspace database, across processes. */
async function withUltracacheConfigurationFetchLock<T>(
  fetch: () => Promise<T>
): Promise<T> {
  if (IS_WASM) {
    return fetch();
  }
  const lock = new FileLock(
    join(
      sharedWorkspaceDataDirectory(workspaceRoot),
      'ultracache-configuration.lock'
    )
  );
  while (!lock.tryLock()) {
    await lock.wait();
  }
  try {
    return await fetch();
  } finally {
    lock.unlock();
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

/** Warns or logs what a resolution came to. */
function reportUltracacheConfigurationResolution(
  outcome: UltracacheConfigurationOutcome
): UltracacheConfigurationOutcome {
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
    )}`
  );
  return outcome;
}
