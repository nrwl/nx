import type { Tree } from '@nx/devkit';
import { addProjectConfiguration, joinPathFragments } from '@nx/devkit';
import type { AngularProjectConfiguration } from '../../../utils/types';
import type { NormalizedSchema } from './normalized-schema';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';

export function addProject(
  tree: Tree,
  libraryOptions: NormalizedSchema['libraryOptions']
) {
  const project: AngularProjectConfiguration = {
    name: libraryOptions.name,
    root: libraryOptions.projectRoot,
    sourceRoot: joinPathFragments(libraryOptions.projectRoot, 'src'),
    prefix: libraryOptions.prefix,
    tags: libraryOptions.parsedTags,
    projectType: 'library',
    targets: {},
  };

  if (libraryOptions.buildable || libraryOptions.publishable) {
    const executor = libraryOptions.publishable
      ? '@nx/angular:package'
      : '@nx/angular:ng-packagr-lite';

    addBuildTargetDefaults(tree, executor);

    project.targets.build = {
      executor,
      outputs: ['{workspaceRoot}/dist/{projectRoot}'],
      options: {
        project: `${libraryOptions.projectRoot}/ng-package.json`,
      },
      configurations: {
        production: {
          tsConfig: `${libraryOptions.projectRoot}/tsconfig.lib.prod.json`,
        },
        development: {
          tsConfig: `${libraryOptions.projectRoot}/tsconfig.lib.json`,
        },
      },
      defaultConfiguration: 'production',
    };
  }

  addProjectConfiguration(tree, libraryOptions.name, project);
  return project;
}
