import {
  chain,
  externalSchematic,
  Rule,
  schematic,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { formatFiles } from '@nrwl/workspace';
import { libsDir } from '@nrwl/workspace/src/utils/ast-utils';
import { addFiles } from './lib/add-files';
import { normalizeOptions } from './lib/normalize-options';
import { updateTsConfig } from './lib/update-tsconfig';
import { updateWorkspaceJson } from './lib/update-workspace-json';
import { Schema } from './schema';

export default function (schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    return chain([
      externalSchematic('@nrwl/node', 'lib', {
        ...schema,
        publishable: true,
        importPath: schema.importPath,
        unitTestRunner: options.unitTestRunner,
      }),
      addFiles(options),
      updateWorkspaceJson(options),
      updateTsConfig(options),
      schematic('e2e-project', {
        pluginName: options.name,
        projectDirectory: options.projectDirectory,
        pluginOutputPath: `dist/${libsDir(host)}/${options.projectDirectory}`,
        npmPackageName: options.npmPackageName,
      }),
      formatFiles(options),
    ]);
  };
}
