import type { Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  joinPathFragments,
  readJson,
} from '@nx/devkit';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { addReleaseConfigForNonTsSolution } from '@nx/js/src/generators/library/utils/add-release-config';
import { shouldUseLegacyVersioning } from 'nx/src/command-line/release/config/use-legacy-versioning';
import type { AngularProjectConfiguration } from '../../../utils/types';
import type { NormalizedSchema } from './normalized-schema';

export async function addProject(
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
        tsConfig: `${libraryOptions.projectRoot}/tsconfig.lib.json`,
      },
      configurations: {
        production: {
          tsConfig: `${libraryOptions.projectRoot}/tsconfig.lib.prod.json`,
        },
        development: {},
      },
      defaultConfiguration: 'production',
    };

    if (libraryOptions.publishable) {
      const nxJson = readJson(tree, 'nx.json');
      await addReleaseConfigForNonTsSolution(
        shouldUseLegacyVersioning(nxJson.release),
        tree,
        libraryOptions.name,
        project
      );
    }
  }

  addProjectConfiguration(tree, libraryOptions.name, project);
  return project;
}
