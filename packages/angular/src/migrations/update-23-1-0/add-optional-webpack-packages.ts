import {
  addDependenciesToPackageJson,
  getProjects,
  readNxJson,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
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

function getTargetFromTargetString(
  targetString: string,
  projects: ReturnType<typeof getProjects>
): TargetConfiguration | undefined {
  const [projectName, targetName] = targetString.split(':');
  return targetName
    ? projects.get(projectName)?.targets?.[targetName]
    : undefined;
}

function usesWebpackDevServer(
  target: TargetConfiguration,
  projects: ReturnType<typeof getProjects>
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

      const buildTargetConfiguration = getTargetFromTargetString(
        buildTarget,
        projects
      );
      return (
        buildTargetConfiguration !== undefined &&
        webpackBuildTargetExecutors.has(buildTargetConfiguration.executor)
      );
    }
  );
}

export default async function addOptionalWebpackPackages(tree: Tree) {
  const projects = getProjects(tree);
  let needsWebpack = false;
  let needsModuleFederation = false;
  let needsRspack = false;

  for (const [, project] of projects) {
    for (const target of Object.values(project.targets ?? {})) {
      needsWebpack ||=
        webpackExecutors.has(target.executor) ||
        usesWebpackDevServer(target, projects);
      needsModuleFederation ||= moduleFederationExecutors.has(target.executor);
      needsRspack ||= target.executor?.startsWith('@nx/rspack:') ?? false;
    }
  }

  const nxJson = readNxJson(tree);

  // targetDefaults are keyed by target name or executor; a project's empty
  // target can inherit its executor from a default, so scan them too.
  for (const [targetOrExecutor, config] of Object.entries(
    nxJson?.targetDefaults ?? {}
  )) {
    // The array value form doesn't carry an inheritable executor.
    if (Array.isArray(config)) {
      continue;
    }
    for (const executor of [targetOrExecutor, config.executor]) {
      if (executor == null) {
        continue;
      }
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
