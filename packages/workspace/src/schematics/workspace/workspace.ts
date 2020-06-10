import {
  apply,
  branchAndMerge,
  chain,
  mergeWith,
  noop,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { join, strings } from '@angular-devkit/core';
import {
  angularCliVersion,
  eslintVersion,
  nxVersion,
  prettierVersion,
  typescriptVersion,
} from '../../utils/versions';
import { readFileSync } from 'fs';

export const DEFAULT_NRWL_PRETTIER_CONFIG = {
  singleQuote: true,
};

const decorateAngularClI = (host: Tree) => {
  const decorateCli = readFileSync(
    join(__dirname as any, '..', 'utils', 'decorate-angular-cli.js__tmpl__')
  ).toString();
  host.create('decorate-angular-cli.js', decorateCli);
};

export default function (options: Schema): Rule {
  if (!options.name) {
    throw new Error(`Invalid options, "name" is required.`);
  }

  return (host: Tree, context: SchematicContext) => {
    const npmScope = options.npmScope ? options.npmScope : options.name;
    const templateSource = apply(url('./files'), [
      template({
        utils: strings,
        dot: '.',
        tmpl: '',
        workspaceFile: options.cli === 'angular' ? 'angular' : 'workspace',
        cliCommand: options.cli === 'angular' ? 'ng' : 'nx',
        nxCli: false,
        typescriptVersion,
        prettierVersion,
        eslintVersion,
        // angular cli is used only when workspace schematics is added to angular cli
        angularCliVersion,
        ...(options as object),
        nxVersion,
        npmScope,
        defaultNrwlPrettierConfig: JSON.stringify(
          DEFAULT_NRWL_PRETTIER_CONFIG,
          null,
          2
        ),
      }),
    ]);
    return chain([
      branchAndMerge(
        chain([
          mergeWith(templateSource),
          options.cli === 'angular' ? decorateAngularClI : noop(),
        ])
      ),
    ])(host, context);
  };
}
