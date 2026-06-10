import {
  formatFiles,
  getProjects,
  updateProjectConfiguration,
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

export default async function (tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, project] of projects) {
    if (project.projectType !== 'application') {
      continue;
    }

    let isUpdated = false;
    for (const target of Object.values(project.targets ?? {})) {
      if (!ssrApplicationExecutors.includes(target.executor)) {
        continue;
      }

      for (const [, options] of allTargetOptions<{
        ssr?:
          | boolean
          | {
              experimentalPlatform?: 'node' | 'neutral';
              platform?: 'node' | 'neutral';
            };
      }>(target)) {
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
    }

    if (isUpdated) {
      updateProjectConfiguration(tree, projectName, project);
    }
  }

  await formatFiles(tree);
}
