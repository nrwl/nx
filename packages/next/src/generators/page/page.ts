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

/*
 * This schematic is basically the React component one, but for Next we need
 * extra dependencies for css, sass, less style options, and make sure
 * it is under `pages` folder.
 */
export async function pageGenerator(host: Tree, schema: Schema) {
  const options = await normalizeOptions(host, schema);
  const componentTask = await reactComponentGenerator(host, {
    ...options,
    isNextPage: true,
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
  // Get the project name first so we can determine the router directory
  const { project: determinedProjectName } =
    await determineArtifactNameAndDirectoryOptions(host, {
      name: options.name,
      path: options.path,
    });

  const project = readProjectConfiguration(host, determinedProjectName);

  // app/ is a reserved folder in nextjs so it is safe to check it's existence
  const isAppRouter =
    host.exists(`${project.root}/app`) ||
    host.exists(`${project.root}/src/app`);

  const { project: projectName, fileName } =
    await determineArtifactNameAndDirectoryOptions(host, {
      name: options.name,
      fileName: isAppRouter ? 'page' : 'index',
      path: options.path,
      fileExtension: 'tsx',
    });
  return {
    ...options,
    fileName,
    projectName,
  };
}

export default pageGenerator;
