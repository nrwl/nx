import { logger } from '@nx/devkit';

// TODO(v25): Delete @nx/module-federation (NXC-5165). It only ships so `nx migrate` can run its v24 migrations.
const REMOVED_MESSAGE =
  'Nx Module Federation was removed in Nx v24. `@nx/module-federation` only exports stubs that keep old configs loadable during project graph creation; they do not configure Module Federation. Follow https://nx.dev/docs/kb/migrate-from-nx-module-federation (React) or https://nx.dev/docs/kb/migrate-angular-module-federation (Angular) to move to the official Module Federation plugin.';

let warned = false;

function warnRemoved(): void {
  if (warned) return;
  warned = true;
  logger.warn(REMOVED_MESSAGE);
}

// Graph creation only reads the config, so it keeps working; a build would silently drop federation.
function failOutsideGraphCreation(): void {
  if (global.NX_GRAPH_CREATION) {
    warnRemoved();
    return;
  }
  throw new Error(REMOVED_MESSAGE);
}

type IdentityConfigFn = <T>(config: T, ...rest: unknown[]) => T;

/** @deprecated Removed in Nx v24. Use `ModuleFederationPlugin` from `@module-federation/enhanced`. This stub will be removed in Nx v25. */
export async function withModuleFederation(
  ..._args: unknown[]
): Promise<IdentityConfigFn> {
  failOutsideGraphCreation();
  return (config) => config;
}

/** @deprecated Removed in Nx v24. Use `ModuleFederationPlugin` from `@module-federation/enhanced`. This stub will be removed in Nx v25. */
export async function withModuleFederationForSSR(
  ..._args: unknown[]
): Promise<IdentityConfigFn> {
  failOutsideGraphCreation();
  return (config) => config;
}

/** @deprecated Removed in Nx v24. Use `ModuleFederationPlugin` from `@module-federation/enhanced`. This stub will be removed in Nx v25. */
export class NxModuleFederationPlugin {
  constructor(..._args: unknown[]) {
    failOutsideGraphCreation();
  }

  apply(): void {
    throw new Error(REMOVED_MESSAGE);
  }
}

// Dropping the dev server plugin only stops serve from starting remotes, so a
// config already on the official plugin should still build.
class RemovedDevServerPlugin {
  constructor(..._args: unknown[]) {
    warnRemoved();
  }

  apply(): void {}
}

/** @deprecated Removed in Nx v24. Serve hosts and remotes with their own serve targets. This stub will be removed in Nx v25. */
export class NxModuleFederationDevServerPlugin extends RemovedDevServerPlugin {}

/** @deprecated Removed in Nx v24. Serve hosts and remotes with their own serve targets. This stub will be removed in Nx v25. */
export class NxModuleFederationSSRDevServerPlugin extends RemovedDevServerPlugin {}
