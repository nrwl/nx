import {
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { allTargetOptions } from '../../utils/targets';

// Application builders whose SSR `experimentalPlatform` option Angular v22
// renamed to `platform`. This mirrors Angular's `update-workspace-config`
// migration (which targets the upstream `@angular/build:application` and
// `@angular-devkit/build-angular:application` builders) and additionally covers
// the `@nx/angular:application` executor that wraps them, since Nx does not run
// Angular's own ng-update migrations.
const ssrApplicationExecutors = [
  '@angular/build:application',
  '@angular-devkit/build-angular:application',
  '@nx/angular:application',
];

type SsrTargetOptions = {
  ssr?:
    | boolean
    | {
        experimentalPlatform?: 'node' | 'neutral';
        platform?: 'node' | 'neutral';
      };
};

function renameSsrPlatform(
  target: Pick<TargetConfiguration, 'options' | 'configurations'>
): boolean {
  let isUpdated = false;
  for (const [, options] of allTargetOptions(
    target as TargetConfiguration<SsrTargetOptions>
  )) {
    const ssr = options.ssr;
    if (!ssr || typeof ssr !== 'object') {
      continue;
    }

    const platform = ssr.experimentalPlatform;
    if (platform) {
      ssr.platform = platform;
      delete ssr.experimentalPlatform;
      isUpdated = true;
    }
  }

  return isUpdated;
}

export default async function (tree: Tree) {
  // project.json target options and configurations
  for (const [projectName, project] of getProjects(tree)) {
    if (project.projectType !== 'application') {
      continue;
    }

    let isUpdated = false;
    for (const target of Object.values(project.targets ?? {})) {
      if (!ssrApplicationExecutors.includes(target.executor)) {
        continue;
      }
      if (renameSsrPlatform(target)) {
        isUpdated = true;
      }
    }

    if (isUpdated) {
      updateProjectConfiguration(tree, projectName, project);
    }
  }

  // nx.json targetDefaults (keyed by target name or executor)
  const nxJson = readNxJson(tree);
  if (nxJson?.targetDefaults) {
    let isUpdated = false;

    for (const [targetOrExecutor, targetConfig] of Object.entries(
      nxJson.targetDefaults
    )) {
      // This migration predates the filtered array value form; values are
      // plain objects here.
      if (Array.isArray(targetConfig)) {
        continue;
      }
      if (
        !ssrApplicationExecutors.includes(targetOrExecutor) &&
        !ssrApplicationExecutors.includes(targetConfig.executor)
      ) {
        continue;
      }
      if (renameSsrPlatform(targetConfig)) {
        isUpdated = true;
      }
    }

    if (isUpdated) {
      updateNxJson(tree, nxJson);
    }
  }

  await formatFiles(tree);
}
