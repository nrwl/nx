import { chain, externalSchematic, Rule } from '@angular-devkit/schematics';
import { addStyleDependencies } from '../../utils/styles';

interface Schema {
  name: string;
  project: string;
  style: string;
  withTests?: boolean;
}

/*
 * This schematic is basically the React component one, but for Next we need
 * extra dependencies for css, sass, less, styl style options, and make sure
 * it is under `pages` folder.
 */
export default function (options: Schema): Rule {
  return chain([
    externalSchematic('@nrwl/react', 'component', {
      ...options,
      directory: 'pages', // This HAS to be here or Next won't work!
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
