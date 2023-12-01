import type { Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  joinPathFragments,
  readNxJson,
  updateNxJson,
} from '@nx/devkit';
import type { AngularProjectConfiguration } from '../../../utils/types';
import type { NormalizedSchema } from './normalized-schema';

export function addProject(
  tree: Tree,
  libraryOptions: NormalizedSchema['libraryOptions']
) {
  const executor = libraryOptions.publishable
    ? '@nx/angular:package'
    : '@nx/angular:ng-packagr-lite';
  addTargetDefaults(tree, executor);
  const project: AngularProjectConfiguration = {
    name: libraryOptions.name,
    root: libraryOptions.projectRoot,
    sourceRoot: joinPathFragments(libraryOptions.projectRoot, 'src'),
    prefix: libraryOptions.prefix,
    tags: libraryOptions.parsedTags,
    projectType: 'library',
    targets: {
      build:
        libraryOptions.buildable || libraryOptions.publishable
          ? {
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
            }
          : undefined,
    },
  };

  addProjectConfiguration(tree, libraryOptions.name, project);
  return project;
}
function addTargetDefaults(tree: Tree, executor: string) {
  const nxJson = readNxJson(tree);

  const productionFileset = nxJson.namedInputs?.production;

  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults[executor] ??= {};
  nxJson.targetDefaults[executor].dependsOn ??= ['^build'];
  nxJson.targetDefaults[executor].inputs ??= productionFileset
    ? ['production', '^production']
    : ['default', '^default'];

  updateNxJson(tree, nxJson);
}
