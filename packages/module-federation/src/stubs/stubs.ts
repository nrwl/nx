import { logger } from '@nx/devkit';

// TODO(v25): Delete @nx/module-federation. It only ships so `nx migrate` can run its v24 migrations.
const REMOVED_MESSAGE =
  'Nx Module Federation was removed in Nx v24. `@nx/module-federation` only exports stubs that keep old configs loadable; they do not configure Module Federation. Run `nx migrate` to get the Module Federation migration, or follow https://nx.dev/docs/kb/migrate-from-nx-module-federation (React) or https://nx.dev/docs/kb/migrate-angular-module-federation (Angular).';

let warned = false;

function warnRemoved(): void {
  if (warned) return;
  warned = true;
  logger.warn(REMOVED_MESSAGE);
}

type IdentityConfigFn = <T>(config: T, ...rest: unknown[]) => T;

/** @deprecated Removed in Nx v24. Use `ModuleFederationPlugin` from `@module-federation/enhanced`. This stub will be removed in Nx v25. */
export async function withModuleFederation(
  ..._args: unknown[]
): Promise<IdentityConfigFn> {
  warnRemoved();
  return (config) => config;
}

/** @deprecated Removed in Nx v24. Use `ModuleFederationPlugin` from `@module-federation/enhanced`. This stub will be removed in Nx v25. */
export async function withModuleFederationForSSR(
  ..._args: unknown[]
): Promise<IdentityConfigFn> {
  warnRemoved();
  return (config) => config;
}

class RemovedPlugin {
  constructor(..._args: unknown[]) {
    warnRemoved();
  }

  apply(): void {}
}

/** @deprecated Removed in Nx v24. Use `ModuleFederationPlugin` from `@module-federation/enhanced`. This stub will be removed in Nx v25. */
export class NxModuleFederationPlugin extends RemovedPlugin {}

/** @deprecated Removed in Nx v24. Serve hosts and remotes with their own serve targets. This stub will be removed in Nx v25. */
export class NxModuleFederationDevServerPlugin extends RemovedPlugin {}

/** @deprecated Removed in Nx v24. Serve hosts and remotes with their own serve targets. This stub will be removed in Nx v25. */
export class NxModuleFederationSSRDevServerPlugin extends RemovedPlugin {}
