import { findAncestorNodeModules } from '../nx-cloud/resolution-helpers';
import {
  verifyOrUpdateNxCloudClient,
  type NxCloudClient,
} from '../nx-cloud/update-manager';
import { workspaceRoot } from '../utils/workspace-root';
import type { UltracacheCloudOptions } from './config';

const READ_TIMEOUT_MS = 10_000;

/** The Nx Cloud client's `readUltracacheConfigurations` contract, as far as nx uses it. */
export interface ReadUltracacheConfigurationsOptions {
  workspaceRoot?: string;
  nxCloudOptions?: UltracacheCloudOptions;
  timeoutMs?: number;
}

export interface ReadUltracacheConfiguration {
  commit: string;
  inputs: readonly string[];
  outputs: readonly string[];
}

export interface ReadUltracacheConfigurationsResult {
  configurations: Readonly<Record<string, ReadUltracacheConfiguration>>;
}

export interface ReadUltracacheConfigurationFilesResult {
  commits: string[];
  updatedAt: number;
  manifestPath: string;
  filesDirectory: string;
}

/**
 * Reads HEAD's Ultracache configurations from Nx Cloud. Throws with a `code`
 * saying why it could not: the client's own, or `NO_CLOUD_CLIENT`, `UNSUPPORTED_CLIENT` or
 * `NO_CONFIGURATIONS`.
 */
export async function fetchUltracacheConfigurations(
  runnerOptions: UltracacheCloudOptions
): Promise<
  | ReadUltracacheConfigurationsResult
  | { files: ReadUltracacheConfigurationFilesResult }
> {
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
  const options = {
    workspaceRoot,
    nxCloudOptions: runnerOptions,
    timeoutMs: READ_TIMEOUT_MS,
  };
  if (typeof client.readUltracacheConfigurationFiles === 'function') {
    const files = await client.readUltracacheConfigurationFiles(options);
    if (files) return { files };
  } else if (typeof client.readUltracacheConfigurations === 'function') {
    const result = await client.readUltracacheConfigurations(options);
    if (result) return result;
  } else {
    throw codedError(
      'UNSUPPORTED_CLIENT',
      'The installed Nx Cloud client does not expose Ultracache configurations; update nx-cloud'
    );
  }
  throw codedError(
    'NO_CONFIGURATIONS',
    'Nx Cloud returned no Ultracache configurations'
  );
}

export async function loadCloudClient(
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
