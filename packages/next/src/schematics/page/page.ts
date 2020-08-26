import { chain, externalSchematic, Rule } from '@angular-devkit/schematics';
import { addStyleDependencies } from '../../utils/styles';
import { Schema } from './schema';

/*
 * This schematic is basically the React component one, but for Next we need
 * extra dependencies for css, sass, less, styl style options, and make sure
 * it is under `pages` folder.
 */
export default function (options: Schema): Rule {
  return chain([
    externalSchematic('@nrwl/react', 'component', {
      ...options,
      directory: options.directory ? `pages/${options.directory}` : 'pages',
      pascalCaseFiles: false,
      export: false,
      classComponent: false,
      routing: false,
      skipTests: !options.withTests,
      flat: true,
    }),
    addStyleDependencies(options.style),
  ]);
}
