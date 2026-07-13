import {
  addDependenciesToPackageJson,
  getProjects,
  joinPathFragments,
  type NxJsonConfiguration,
  readNxJson,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { readTargetDefaultsForTarget } from '@nx/devkit/internal';
import { nxVersion, webpackMergeVersion } from '../../utils/versions';

const webpackExecutors = new Set([
  '@nx/angular:webpack-browser',
  '@nx/angular:webpack-server',
]);
const webpackBuildTargetExecutors = new Set([
  '@nx/angular:webpack-browser',
  '@angular-devkit/build-angular:browser',
]);
const moduleFederationExecutors = new Set([
  '@nx/angular:module-federation-dev-server',
  '@nx/angular:module-federation-dev-ssr',
]);

function resolveBuildTargetExecutor(
  targetString: string,
  projects: ReturnType<typeof getProjects>,
  targetDefaults: NxJsonConfiguration['targetDefaults']
): string | undefined {
  const [projectName, targetName] = targetString.split(':');
  const target = targetName
    ? projects.get(projectName)?.targets?.[targetName]
    : undefined;
  if (target === undefined) {
    return undefined;
  }

  // The referenced build target can inherit its executor from targetDefaults,
  // which the raw project config does not merge, so resolve it before matching.
  return (
    target.executor ??
    readTargetDefaultsForTarget(targetName, targetDefaults)?.executor
  );
}

function usesWebpackDevServer(
  target: TargetConfiguration,
  projects: ReturnType<typeof getProjects>,
  targetDefaults: NxJsonConfiguration['targetDefaults']
): boolean {
  if (target.executor !== '@nx/angular:dev-server') {
    return false;
  }

  return [target.options, ...Object.values(target.configurations ?? {})].some(
    (options) => {
      const buildTarget = options?.buildTarget ?? options?.browserTarget;
      if (typeof buildTarget !== 'string') {
        return false;
      }

      const executor = resolveBuildTargetExecutor(
        buildTarget,
        projects,
        targetDefaults
      );
      return (
        executor !== undefined && webpackBuildTargetExecutors.has(executor)
      );
    }
  );
}

export default async function addOptionalWebpackPackages(tree: Tree) {
  const projects = getProjects(tree);
  const nxJson = readNxJson(tree);
  const targetDefaults = nxJson?.targetDefaults;
  let needsWebpack = false;
  let needsModuleFederation = false;
  let needsRspack = false;

  for (const [, project] of projects) {
    for (const target of Object.values(project.targets ?? {})) {
      needsWebpack ||=
        webpackExecutors.has(target.executor) ||
        usesWebpackDevServer(target, projects, targetDefaults);
      needsModuleFederation ||= moduleFederationExecutors.has(target.executor);
      needsRspack ||= target.executor?.startsWith('@nx/rspack:') ?? false;
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

  // targetDefaults are keyed by target name or executor, and a default can set
  // an executor that an empty project target inherits, so scan the keys and any
  // executor on the default (both the object and array forms).
  for (const [targetOrExecutor, config] of Object.entries(
    targetDefaults ?? {}
  )) {
    const executors = [targetOrExecutor];
    for (const entry of Array.isArray(config) ? config : [config]) {
      if (entry.executor != null) {
        executors.push(entry.executor);
      }
    }
    for (const executor of executors) {
      needsWebpack ||= webpackExecutors.has(executor);
      needsModuleFederation ||= moduleFederationExecutors.has(executor);
      needsRspack ||= executor.startsWith('@nx/rspack:');
    }
  }

  needsRspack ||=
    nxJson?.plugins?.some((plugin) =>
      typeof plugin === 'string'
        ? plugin === '@nx/rspack/plugin'
        : plugin.plugin === '@nx/rspack/plugin'
    ) ?? false;

  if (!needsWebpack && !needsModuleFederation && !needsRspack) {
    return;
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      ...(needsWebpack
        ? {
            '@nx/webpack': nxVersion,
            'webpack-merge': webpackMergeVersion,
          }
        : {}),
      ...(needsModuleFederation ? { '@nx/module-federation': nxVersion } : {}),
      ...(needsRspack ? { '@nx/rspack': nxVersion } : {}),
    },
    undefined,
    true
  );
}
