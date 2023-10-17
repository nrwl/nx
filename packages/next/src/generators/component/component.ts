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

interface Schema {
  name: string;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. The project will be determined from the directory provided. It will be removed in Nx v18.
   */
  project: string;
  style: SupportedStyles;
  directory?: string;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. This option will be removed in Nx v18.
   */
  flat?: boolean;
  /**
   * @deprecated Provide the `name` in pascal-case and use the `as-provided` format. This option will be removed in Nx v18.
   */
  pascalCaseFiles?: boolean;
  /**
   * @deprecated Provide the `directory` in pascal-case and use the `as-provided` format. This option will be removed in Nx v18.
   */
  pascalCaseDirectory?: boolean;
  nameAndDirectoryFormat?: 'as-provided' | 'derived';
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

export async function componentGenerator(host: Tree, schema: Schema) {
  return componentGeneratorInternal(host, {
    nameAndDirectoryFormat: 'derived',
    ...schema,
  });
}

/*
 * This schematic is basically the React one, but for Next we need
 * extra dependencies for css, sass, less style options.
 */
export async function componentGeneratorInternal(host: Tree, options: Schema) {
  const project = readProjectConfiguration(host, options.project);
  const componentInstall = await reactComponentGenerator(host, {
    ...options,
    directory: options.directory,
    derivedDirectory: getDirectory(host, options),
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
