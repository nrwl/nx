import {
  addDependenciesToPackageJson,
  getProjects,
  joinPathFragments,
  type NxJsonConfiguration,
  readNxJson,
  type Tree,
} from '@nx/devkit';
import {
  expressVersion,
  httpProxyMiddlewareVersion,
  nxVersion,
} from '../../utils/versions';

const moduleFederationExecutors = new Set([
  '@nx/react:module-federation-dev-server',
  '@nx/react:module-federation-ssr-dev-server',
  '@nx/react:module-federation-static-server',
]);
const staticServerExecutor = '@nx/react:module-federation-static-server';

function collectExecutors(
  targetDefaults: NxJsonConfiguration['targetDefaults']
): string[] {
  // targetDefaults are keyed by target name or executor, and a default can set
  // an executor that an empty project target inherits, so scan the keys and any
  // executor on the default (both the object and array forms).
  const executors: string[] = [];
  for (const [targetOrExecutor, config] of Object.entries(
    targetDefaults ?? {}
  )) {
    executors.push(targetOrExecutor);
    for (const entry of Array.isArray(config) ? config : [config]) {
      if (entry.executor != null) {
        executors.push(entry.executor);
      }
    }
  }

  return executors;
}

export default async function addOptionalModuleFederationPackages(tree: Tree) {
  const projects = getProjects(tree);
  const nxJson = readNxJson(tree);
  let needsModuleFederation = false;
  let needsStaticServer = false;

  for (const [, project] of projects) {
    for (const target of Object.values(project.targets ?? {})) {
      needsModuleFederation ||= moduleFederationExecutors.has(target.executor);
      needsStaticServer ||= target.executor === staticServerExecutor;
    }

    // Remotes get a plain dev-server (no Module Federation executor) but still
    // generate a module-federation.config that requires @nx/module-federation
    // at build time, so detect them by that config file too. This covers
    // remotes whose host lives in a different workspace.
    needsModuleFederation ||=
      tree.exists(
        joinPathFragments(project.root, 'module-federation.config.ts')
      ) ||
      tree.exists(
        joinPathFragments(project.root, 'module-federation.config.js')
      );
  }

  for (const executor of collectExecutors(nxJson?.targetDefaults)) {
    needsModuleFederation ||= moduleFederationExecutors.has(executor);
    needsStaticServer ||= executor === staticServerExecutor;
  }

  if (!needsModuleFederation && !needsStaticServer) {
    return;
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      ...(needsModuleFederation ? { '@nx/module-federation': nxVersion } : {}),
      ...(needsStaticServer
        ? {
            express: expressVersion,
            'http-proxy-middleware': httpProxyMiddlewareVersion,
          }
        : {}),
    },
    undefined,
    true
  );
}
