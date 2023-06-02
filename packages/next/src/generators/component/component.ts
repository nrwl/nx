import {
  convertNxGenerator,
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

interface Schema {
  name: string;
  project: string;
  style: SupportedStyles;
  directory?: string;
  flat?: boolean;
  pascalCaseFiles?: boolean;
  pascalCaseDirectory?: boolean;
  skipFormat?: boolean;
}

function getDirectory(host: Tree, options: Schema) {
  const workspace = getProjects(host);
  const projectType = workspace.get(options.project).projectType;

  return options.directory
    ? options.directory
    : projectType === 'application'
    ? 'components'
    : undefined;
}

/*
 * This schematic is basically the React one, but for Next we need
 * extra dependencies for css, sass, less, styl style options.
 */
export async function componentGenerator(host: Tree, options: Schema) {
  const project = readProjectConfiguration(host, options.project);
  const componentInstall = await reactComponentGenerator(host, {
    ...options,
    directory: getDirectory(host, options),
    classComponent: false,
    routing: false,
    skipFormat: true,
  });

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
export const componentSchematic = convertNxGenerator(componentGenerator);
