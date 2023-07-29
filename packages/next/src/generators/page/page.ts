import { componentGenerator as reactComponentGenerator } from '@nx/react';
import {
  convertNxGenerator,
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';

import { addStyleDependencies } from '../../utils/styles';
import { Schema } from './schema';

/*
 * This schematic is basically the React component one, but for Next we need
 * extra dependencies for css, sass, less, styl style options, and make sure
 * it is under `pages` folder.
 */
export async function pageGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);
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

  const styledTask = addStyleDependencies(host, {
    style: options.style,
    swc: !host.exists(joinPathFragments(options.project.root, '.babelrc')),
  });

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(componentTask, styledTask);
}

function normalizeOptions(host: Tree, options: Schema) {
  const project = readProjectConfiguration(host, options.project);

  // app/ is a reserved folder in nextjs so it is safe to check it's existence
  const isAppRouter = host.exists(`${project.root}/app`);
  const routerDirectory = isAppRouter ? 'app' : 'pages';
  const directory = options.directory
    ? `${routerDirectory}/${options.directory}`
    : `${routerDirectory}`;
  const fileName = isAppRouter ? 'page' : !options.flat ? 'index' : undefined;
  return { ...options, project, directory, fileName };
}

export default pageGenerator;
export const pageSchematic = convertNxGenerator(pageGenerator);
