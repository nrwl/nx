import type { SupportedStyles } from '@nrwl/react';
import { componentGenerator as reactComponentGenerator } from '@nrwl/react';
import { convertNxGenerator, Tree } from '@nrwl/devkit';
import { addStyleDependencies } from '../../utils/styles';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

interface Schema {
  name: string;
  project: string;
  style: SupportedStyles;
  directory?: string;
  flat?: boolean;
}

/*
 * This schematic is basically the React one, but for Gatsby we need
 * extra dependencies for css, sass, less, styl style options.
 */
export async function componentGenerator(host: Tree, options: Schema) {
  const componentTask = await reactComponentGenerator(host, {
    ...options,
    directory: options.directory || 'components',
    pascalCaseFiles: false,
    export: false,
    classComponent: false,
    routing: false,
    flat: true,
  });

  const styledTask = addStyleDependencies(host, options.style);

  return runTasksInSerial(componentTask, styledTask);
}

export default componentGenerator;
export const componentSchematic = convertNxGenerator(componentGenerator);
