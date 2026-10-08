import type { NxJsonConfiguration } from '../config/nx-json';
import { isCI } from '../utils/is-ci';
import { isNxCloudConfigured } from '../utils/nx-cloud-utils';

export interface UltracacheCloudOptions {
  accessToken?: string;
  nxCloudId?: string;
  url?: string;
  cloud?: boolean;
}

export interface UltracacheEnv {
  NX_CLOUD_USE_ULTRACACHE?: string;
  NX_NO_CLOUD?: string;
  /** Whether the run's env holds an Nx Cloud token. */
  hasNxCloudToken?: boolean;
}

/**
 * Off unless a CI run opts in with `NX_CLOUD_USE_ULTRACACHE=true` in a
 * workspace that uses Nx Cloud, since there is nothing to fetch from otherwise.
 * `env` defaults to this process's.
 */
export function isUltracacheConfigurationFetchEnabled(
  nxJson: NxJsonConfiguration,
  runnerOptions: UltracacheCloudOptions = {},
  env: UltracacheEnv = ultracacheEnv()
): boolean {
  if (
    env.NX_NO_CLOUD === 'true' ||
    nxJson.neverConnectToCloud ||
    runnerOptions.cloud === false ||
    env.NX_CLOUD_USE_ULTRACACHE !== 'true' ||
    !isCI()
  ) {
    return false;
  }
  return !!env.hasNxCloudToken || isNxCloudConfigured(nxJson);
}

/** The subset of this run's environment the decision reads. */
export function ultracacheEnv(
  env: NodeJS.ProcessEnv = process.env
): UltracacheEnv {
  return {
    NX_CLOUD_USE_ULTRACACHE: env.NX_CLOUD_USE_ULTRACACHE,
    NX_NO_CLOUD: env.NX_NO_CLOUD,
    hasNxCloudToken: !!(env.NX_CLOUD_ACCESS_TOKEN || env.NX_CLOUD_AUTH_TOKEN),
  };
}
