import { logger } from '@nx/devkit';

// TODO(v25): Delete this subpath. It keeps 23.x configs loading during graph creation so `nx migrate` can run.
const REMOVED_MESSAGE =
  'Nx Module Federation was removed in Nx v24. `@nx/rspack/module-federation` is a stub that keeps old configs loadable during project graph creation; it does not configure Module Federation. Follow https://nx.dev/docs/kb/migrate-from-nx-module-federation to move to the official Module Federation plugin.';

type IdentityConfigFn = <T>(config: T, ...rest: unknown[]) => T;

let warned = false;

// Graph creation only reads the config, so it keeps working; a build would silently drop federation.
function failOutsideGraphCreation(): void {
  if (!global.NX_GRAPH_CREATION) throw new Error(REMOVED_MESSAGE);
  if (warned) return;
  warned = true;
  logger.warn(REMOVED_MESSAGE);
}

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
