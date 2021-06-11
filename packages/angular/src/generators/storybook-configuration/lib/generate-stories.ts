import { getE2eProjectName } from '@nrwl/cypress/src/utils/project-name';
import type { Tree } from '@nrwl/devkit';
import { readProjectConfiguration } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import type { StorybookConfigurationOptions } from '../schema';

export async function generateStories(
  tree: Tree,
  options: StorybookConfigurationOptions
) {
  const project = readProjectConfiguration(tree, options.name);
  const e2eProjectName = getE2eProjectName(
    options.name,
    project.root,
    options.cypressDirectory
  );

  const storiesGenerator = wrapAngularDevkitSchematic(
    '@nrwl/angular',
    'stories'
  );
  await storiesGenerator(tree, {
    name: options.name,
    generateCypressSpecs:
      options.configureCypress && options.generateCypressSpecs,
    cypressProject: e2eProjectName,
  });
}
