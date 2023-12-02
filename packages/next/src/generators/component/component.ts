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
  name: string;
  /**
   * @deprecated Provide the `directory` option instead and use the `as-provided` format. The project will be determined from the directory provided. It will be removed in Nx v18.
   */
  project?: string;
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

// TODO(v18): Remove this logic once we no longer derive directory.
function maybeGetDerivedDirectory(host: Tree, options: Schema): string {
  if (!options.project) return options.directory;
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
  const {
    artifactName: name,
    directory,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(host, {
    artifactType: 'component',
    callingGenerator: '@nx/next:component',
    name: options.name,
    directory: options.directory,
    derivedDirectory: maybeGetDerivedDirectory(host, options),
    flat: options.flat,
    nameAndDirectoryFormat: options.nameAndDirectoryFormat,
    project: options.project,
    fileExtension: 'tsx',
    pascalCaseFile: options.pascalCaseFiles,
    pascalCaseDirectory: options.pascalCaseDirectory,
  });

  const componentInstall = await reactComponentGenerator(host, {
    ...options,
    nameAndDirectoryFormat: 'as-provided', // already determined the directory so use as is
    project: undefined,
    directory,
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
