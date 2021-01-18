import { chain, externalSchematic, Rule } from '@angular-devkit/schematics';
import { addStyleDependencies } from '../../utils/styles';
import { wrapAngularDevkitSchematic } from '@nrwl/tao/src/commands/ngcli-adapter';

interface Schema {
  name: string;
  project: string;
  style: string;
  directory?: string;
  flat?: boolean;
}

/*
 * This schematic is basically the React one, but for Gatsby we need
 * extra dependencies for css, sass, less, styl style options.
 */
export default function (options: Schema): Rule {
  return chain([
    externalSchematic('@nrwl/react', 'component', {
      ...options,
      directory: options.directory || 'pages',
      pascalCaseFiles: false,
      export: false,
      classComponent: false,
      routing: false,
      flat: true,
    }),
    addStyleDependencies(options.style),
  ]);
}

export const pageGenerator = wrapAngularDevkitSchematic('@nrwl/gatsby', 'page');
