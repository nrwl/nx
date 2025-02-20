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
import {
  determineArtifactNameAndDirectoryOptions,
  getRelativeCwd,
} from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

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

  let pageSymbolName = options.name;
  if (!pageSymbolName) {
    // if `name` is not provided, we use the last segment of the path
    if (options.path !== '.' && options.path !== '') {
      pageSymbolName = options.path.split('/').pop();
    } else {
      // the user must have cd into a previously created directory, we need to
      // resolve the cwd to get it
      const cwd = getRelativeCwd();
      if (cwd !== '.' && cwd !== '') {
        pageSymbolName = cwd.split('/').pop();
      } else {
        // this can only happen when running from the workspace root, in which
        // case, we don't have a good way to automatically determine the name
        throw new Error(
          'Cannot determine the page name, please provide a `name` or `path` option.'
        );
      }
    }
  }

  const { project: projectName, filePath } =
    await determineArtifactNameAndDirectoryOptions(host, {
      name: pageSymbolName,
      path: joinPathFragments(
        options.path,
        isAppRouter ? 'page.tsx' : 'index.tsx'
      ),
    });
  return {
    ...options,
    path: filePath,
    projectName,
  };
}

export default pageGenerator;
