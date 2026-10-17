import type { NxJsonConfiguration } from '../config/nx-json';
import type { Task } from '../config/task-graph';
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
  NX_CLOUD_ULTRACACHE_MODE?: string;
  NX_NO_CLOUD?: string;
  /** Whether the run's env holds an Nx Cloud token. */
  hasNxCloudToken?: boolean;
}

/**
 * Cloud supplies the workspace default before task planning: WARNING with IO
 * snapshots is `on`, WARNING without them is `warn`, STRICT is `error`, and
 * OFF is `off`. Missing or unrecognized values preserve older clients' behavior.
 * Read after loading configurations: the Cloud client can populate this env
 * during that request on CI providers that do not inject it ahead of time.
 */
export function getDefaultUltracacheMode(
  env: Pick<UltracacheEnv, 'NX_CLOUD_ULTRACACHE_MODE'> = process.env
): Task['ultracache']['mode'] | undefined {
  const mode = env.NX_CLOUD_ULTRACACHE_MODE;
  switch (mode) {
    case 'on':
    case 'warn':
    case 'error':
    case 'off':
      return mode;
    default:
      return undefined;
  }
}

/** Resolve on tasks, never the cached project graph; explicit target modes win. */
export function applyDefaultUltracacheMode(
  tasks: Iterable<Task>,
  mode: Task['ultracache']['mode'] | undefined
): void {
  if (mode === undefined) return;
  for (const task of tasks) {
    if (task.ultracache?.mode === undefined) {
      task.ultracache = { ...task.ultracache, mode };
    }
  }
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
    NX_CLOUD_ULTRACACHE_MODE: env.NX_CLOUD_ULTRACACHE_MODE,
    NX_NO_CLOUD: env.NX_NO_CLOUD,
    hasNxCloudToken: !!(env.NX_CLOUD_ACCESS_TOKEN || env.NX_CLOUD_AUTH_TOKEN),
  };
}
