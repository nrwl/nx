import {
  apply,
  branchAndMerge,
  chain,
  mergeWith,
  Rule,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { strings } from '@angular-devkit/core';
import {
  angularCliVersion,
  prettierVersion,
  typescriptVersion,
  eslintVersion,
  nxVersion
} from '../../utils/versions';

export const DEFAULT_NRWL_PRETTIER_CONFIG = {
  singleQuote: true
};

export default function(options: Schema): Rule {
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
        )
      })
    ]);
    return chain([branchAndMerge(chain([mergeWith(templateSource)]))])(
      host,
      context
    );
  };
}
