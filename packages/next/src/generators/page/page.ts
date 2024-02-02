import { componentGenerator as reactComponentGenerator } from '@nx/react';
import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';

import { addStyleDependencies } from '../../utils/styles';
import { Schema } from './schema';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

export async function pageGenerator(host: Tree, schema: Schema) {
  return pageGeneratorInternal(host, {
    nameAndDirectoryFormat: 'derived',
    ...schema,
  });
}

/*
 * This schematic is basically the React component one, but for Next we need
 * extra dependencies for css, sass, less style options, and make sure
 * it is under `pages` folder.
 */
export async function pageGeneratorInternal(host: Tree, schema: Schema) {
  const options = await normalizeOptions(host, schema);
  const componentTask = await reactComponentGenerator(host, {
    ...options,
    isNextPage: true,
    nameAndDirectoryFormat: 'as-provided', // already determined the directory so use as is
    export: false,
    classComponent: false,
    routing: false,
    skipTests: !options.withTests,
    skipFormat: true,
  });

  const project = readProjectConfiguration(host, options.projectName);
  const styledTask = addStyleDependencies(host, {
    style: options.style,
    swc: !host.exists(joinPathFragments(project.root, '.babelrc')),
  });

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(componentTask, styledTask);
}

async function normalizeOptions(host: Tree, options: Schema) {
  let isAppRouter: boolean;
  let derivedDirectory: string;
  let routerDirectory: string;

  if (options.project) {
    // Legacy behavior, detect app vs page router from specified project.
    // TODO(v19): remove this logic
    const project = readProjectConfiguration(host, options.project);
    // app/ is a reserved folder in nextjs so it is safe to check it's existence
    isAppRouter =
      host.exists(`${project.root}/app`) ||
      host.exists(`${project.root}/src/app`);

    routerDirectory = isAppRouter ? 'app' : 'pages';
    derivedDirectory = options.directory
      ? `${routerDirectory}/${options.directory}`
      : `${routerDirectory}`;
  } else {
    // Get the project name first so we can determine the router directory
    const { project: determinedProjectName } =
      await determineArtifactNameAndDirectoryOptions(host, {
        artifactType: 'page',
        callingGenerator: '@nx/next:page',
        name: options.name,
        directory: options.directory,
      });

    const project = readProjectConfiguration(host, determinedProjectName);

    // app/ is a reserved folder in nextjs so it is safe to check it's existence
    isAppRouter =
      host.exists(`${project.root}/app`) ||
      host.exists(`${project.root}/src/app`);

    routerDirectory = isAppRouter ? 'app' : 'pages';
    // New behavior, use directory as is without detecting whether we're using app or pages router.
    derivedDirectory = options.directory;
  }

  const {
    artifactName: name,
    project: projectName,
    fileName,
    directory,
  } = await determineArtifactNameAndDirectoryOptions(host, {
    artifactType: 'page',
    callingGenerator: '@nx/next:page',
    name: options.name,
    fileName: isAppRouter ? 'page' : 'index',
    directory: options.directory,
    derivedDirectory,
    flat: options.flat,
    nameAndDirectoryFormat: options.nameAndDirectoryFormat,
    project: options.project,
    fileExtension: 'tsx',
  });
  return {
    ...options,
    directory,
    fileName,
    projectName,
  };
}

export default pageGenerator;
