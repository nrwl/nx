import { addStyleDependencies } from '../../utils/styles';
import type { SupportedStyles } from '@nrwl/react';
import { componentGenerator as reactComponentGenerator } from '@nrwl/react';
import { convertNxGenerator, Tree } from '@nrwl/devkit';

interface Schema {
  name: string;
  project: string;
  style: SupportedStyles;
  directory?: string;
  flat?: boolean;
}

/*
 * This schematic is basically the React one, but for Next we need
 * extra dependencies for css, sass, less, styl style options.
 */
export async function componentGenerator(host: Tree, options: Schema) {
  await reactComponentGenerator(host, {
    ...options,
    directory: options.directory || 'components',
    pascalCaseFiles: false,
    export: false,
    classComponent: false,
    routing: false,
  });

  addStyleDependencies(host, options.style);
}

export default componentGenerator;
export const componentSchematic = convertNxGenerator(componentGenerator);
