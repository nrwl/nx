import { findAncestorNodeModules } from '../nx-cloud/resolution-helpers';
import {
  verifyOrUpdateNxCloudClient,
  type NxCloudClient,
} from '../nx-cloud/update-manager';
import { workspaceRoot } from '../utils/workspace-root';
import type { UltracacheCloudOptions } from './config';

const READ_TIMEOUT_MS = 10_000;

/** The Nx Cloud client's `readUltracacheConfiguration` contract, as far as nx uses it. */
export interface ReadUltracacheConfigurationOptions {
  workspaceRoot?: string;
  nxCloudOptions?: UltracacheCloudOptions;
  timeoutMs?: number;
}

export interface ReadUltracacheTaskConfiguration {
  commit: string;
  inputs: readonly string[];
  outputs: readonly string[];
}

export interface ReadUltracacheConfigurationResult {
  snapshots: Readonly<Record<string, ReadUltracacheTaskConfiguration>>;
}

/**
 * Reads HEAD's snapshot set from Nx Cloud. Throws with a `code` saying why it
 * could not: the client's own, or `NO_CLOUD_CLIENT`, `UNSUPPORTED_CLIENT` or
 * `NO_SNAPSHOTS`.
 */
export async function fetchUltracacheConfiguration(
  runnerOptions: UltracacheCloudOptions
): Promise<ReadUltracacheConfigurationResult> {
  const client = await loadCloudClient(runnerOptions).catch((e) => {
    throw codedError(
      'NO_CLOUD_CLIENT',
      e instanceof Error ? e.message : String(e)
    );
  });
  if (!client) {
    throw codedError(
      'NO_CLOUD_CLIENT',
      'The Nx Cloud client could not be loaded'
    );
  }
  if (typeof client.readUltracacheConfiguration !== 'function') {
    throw codedError(
      'UNSUPPORTED_CLIENT',
      'The installed Nx Cloud client does not expose I/O snapshots; update nx-cloud'
    );
  }
  const result = await client.readUltracacheConfiguration({
    workspaceRoot,
    nxCloudOptions: runnerOptions,
    timeoutMs: READ_TIMEOUT_MS,
  });
  if (!result) {
    // The client returns `null` only for a `knownUpdatedAt` match, which nx
    // never sends; treat it as nothing to serve rather than a broken reply.
    throw codedError('NO_SNAPSHOTS', 'Nx Cloud returned no I/O snapshot set');
  }
  return result;
}

async function loadCloudClient(
  runnerOptions: UltracacheCloudOptions
): Promise<NxCloudClient | undefined> {
  const client = (await verifyOrUpdateNxCloudClient(runnerOptions))
    ?.nxCloudClient;
  client?.configureLightClientRequire()(findAncestorNodeModules(__dirname, []));
  return client;
}

function codedError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}
