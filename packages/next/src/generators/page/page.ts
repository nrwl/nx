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
    project: schema.project,
    pascalCaseFiles: false,
    export: false,
    classComponent: false,
    routing: false,
    skipTests: !options.withTests,
    flat: !!options.flat,
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

  if (options.project) {
    // Legacy behavior, detect app vs page router from specified project.
    const project = readProjectConfiguration(host, options.project);
    // app/ is a reserved folder in nextjs so it is safe to check it's existence
    isAppRouter = host.exists(`${project.root}/app`);
  } else {
    // New behavior, detect app vs page router from the positional arg or directory path
    const parts =
      options.name.includes('/') || // mac, linux
      options.name.includes('\\') // windows
        ? options.name.split(/[\/\\]/)
        : options.directory.split(/[\/\\]/);
    if (parts.includes('pages')) {
      isAppRouter = false;
    } else if (parts.includes('app')) {
      isAppRouter = true;
    } else {
    }
  }

  const {
    artifactName: name,
    project: projectName,
    filePath,
    fileName,
    nameAndDirectoryFormat,
  } = await determineArtifactNameAndDirectoryOptions(host, {
    artifactType: 'component',
    callingGenerator: '@nx/react:component',
    name: options.name,
    fileName: isAppRouter ? 'page' : 'index',
    directory: options.directory,
    derivedDirectory: options.directory,
    flat: options.flat,
    nameAndDirectoryFormat: options.nameAndDirectoryFormat,
    project: options.project,
    fileExtension: 'tsx',
  });

  const routerDirectory = isAppRouter ? 'app' : 'pages';
  const derivedDirectory = options.directory
    ? `${routerDirectory}/${options.directory}`
    : `${routerDirectory}`;

  return {
    ...options,
    fileName,
    projectName,
    derivedDirectory,
    filePath,
    nameAndDirectoryFormat,
  };
}

export default pageGenerator;
