import {
  formatFiles,
  getProjects,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import type { SupportedStyles } from '@nx/react';
import { componentGenerator as reactComponentGenerator } from '@nx/react';

import { addStyleDependencies } from '../../utils/styles';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

interface Schema {
  path: string;
  name?: string;
  style: SupportedStyles;
  skipFormat?: boolean;
}

/*
 * This schematic is basically the React one, but for Next we need
 * extra dependencies for css, sass, less style options.
 */
export async function componentGenerator(host: Tree, options: Schema) {
  const {
    artifactName: name,
    directory,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(host, {
    name: options.name,
    path: options.path,
    fileExtension: 'tsx',
  });

  const componentInstall = await reactComponentGenerator(host, {
    ...options,
    name,
    classComponent: false,
    routing: false,
    skipFormat: true,
  });

  const project = readProjectConfiguration(host, projectName);
  const styledInstall = addStyleDependencies(host, {
    style: options.style,
    swc: !host.exists(joinPathFragments(project.root, '.babelrc')),
  });

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(styledInstall, componentInstall);
}

export default componentGenerator;
