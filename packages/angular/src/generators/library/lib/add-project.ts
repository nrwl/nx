import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import { addProjectConfiguration, joinPathFragments } from '@nrwl/devkit';
import { NormalizedSchema } from './normalized-schema';

export function addProject(
  tree: Tree,
  libraryOptions: NormalizedSchema['libraryOptions']
) {
  const project: ProjectConfiguration & { prefix: string } = {
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
              executor: libraryOptions.publishable
                ? '@nrwl/angular:package'
                : '@nrwl/angular:ng-packagr-lite',
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
