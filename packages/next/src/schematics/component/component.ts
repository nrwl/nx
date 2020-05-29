import { chain, externalSchematic, Rule } from '@angular-devkit/schematics';
import { addStyleDependencies } from '../../utils/styles';

interface Schema {
  name: string;
  project: string;
  style: string;
  directory?: string;
  flat?: boolean;
}

/*
 * This schematic is basically the React one, but for Next we need
 * extra dependencies for css, sass, less, styl style options.
 */
export default function (options: Schema): Rule {
  return chain([
    externalSchematic('@nrwl/react', 'component', {
      ...options,
      directory: options.directory || 'components',
      pascalCaseFiles: false,
      export: false,
      classComponent: false,
      routing: false,
    }),
    addStyleDependencies(options.style),
  ]);
}
