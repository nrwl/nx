import {
  componentGenerator as reactComponentGenerator,
  SupportedStyles,
} from '@nrwl/react';
import { convertNxGenerator, Tree } from '@nrwl/devkit';

import { addStyleDependencies } from '../../utils/styles';

interface Schema {
  name: string;
  project: string;
  style: SupportedStyles;
  directory?: string;
  flat?: boolean;
}

/*
 * This schematic is basically the React component one, but for Gatsby we need
 * extra dependencies for css, sass, less, styl style options, and make sure
 * it is under `pages` folder.
 */
export async function pageGenerator(host: Tree, options: Schema) {
  let installTask = await reactComponentGenerator(host, {
    ...options,
    directory: options.directory || 'pages',
    pascalCaseFiles: false,
    export: false,
    classComponent: false,
    routing: false,
    flat: true,
  });

  installTask = addStyleDependencies(host, options.style) || installTask;

  return installTask;
}

export default pageGenerator;
export const pageSchematic = convertNxGenerator(pageGenerator);
