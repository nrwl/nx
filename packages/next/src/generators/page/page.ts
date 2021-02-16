import { componentGenerator as reactComponentGenerator } from '@nrwl/react';
import { convertNxGenerator, Tree } from '@nrwl/devkit';

import { addStyleDependencies } from '../../utils/styles';
import { Schema } from './schema';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

/*
 * This schematic is basically the React component one, but for Next we need
 * extra dependencies for css, sass, less, styl style options, and make sure
 * it is under `pages` folder.
 */
export async function pageGenerator(host: Tree, options: Schema) {
  const componentTask = await reactComponentGenerator(host, {
    ...options,
    directory: options.directory ? `pages/${options.directory}` : 'pages',
    pascalCaseFiles: false,
    export: false,
    classComponent: false,
    routing: false,
    skipTests: !options.withTests,
    flat: true,
  });

  const styledTask = addStyleDependencies(host, options.style);

  return runTasksInSerial(componentTask, styledTask);
}

export default pageGenerator;
export const pageSchematic = convertNxGenerator(pageGenerator);
