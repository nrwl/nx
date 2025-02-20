import {
  formatFiles,
  getProjects,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { allTargetOptions } from '../../utils/targets';

export const executorsToAddPolyfillTo = [
  '@angular/build:application',
  '@angular-devkit/build-angular:application',
  '@nx/angular:application',
  '@angular-devkit/build-angular:browser-esbuild',
  '@nx/angular:browser-esbuild',
];

export default async function (tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, project] of projects) {
    if (project.projectType !== 'application') {
      continue;
    }

    let isUpdated = false;
    for (const target of Object.values(project.targets ?? {})) {
      if (!executorsToAddPolyfillTo.includes(target.executor)) {
        continue;
      }

      const polyfills = target.options?.['polyfills'];
      if (
        Array.isArray(polyfills) &&
        polyfills.some(
          (polyfill) =>
            typeof polyfill === 'string' &&
            polyfill.startsWith('@angular/localize')
        )
      ) {
        // the polyfill is already present, skip
        continue;
      }

      // Only add '@angular/localize/init' polyfill if 'localize' option is enabled
      for (const [, options] of allTargetOptions(target)) {
        if (options['localize']) {
          target.options ??= {};
          const polyfills = target.options['polyfills'];
          // Ensure polyfills is an array before pushing
          if (typeof polyfills === 'string') {
            target.options['polyfills'] = [polyfills];
          } else if (!Array.isArray(polyfills)) {
            target.options['polyfills'] = [];
          }
          target.options['polyfills'].push('@angular/localize/init');
          isUpdated = true;
          break;
        }
      }
    }

    if (isUpdated) {
      updateProjectConfiguration(tree, projectName, project);
    }
  }

  await formatFiles(tree);
}
