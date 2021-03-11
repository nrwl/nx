import {
  chain,
  externalSchematic,
  Rule,
  schematic,
  Tree,
} from '@angular-devkit/schematics';
import { addDepsToPackageJson } from '@nrwl/workspace';
import { formatFiles } from '@nrwl/workspace';
import { libsDir } from '@nrwl/workspace/src/utils/ast-utils';
import { nxVersion } from '@nrwl/workspace/src/utils/versions';
import { addFiles } from './lib/add-files';
import { normalizeOptions } from './lib/normalize-options';
import { updateWorkspaceJson } from './lib/update-workspace-json';
import { Schema } from './schema';

export default function (schema: Schema): Rule {
  return (host: Tree) => {
    const options = normalizeOptions(host, schema);
    const { unitTestRunner } = options;
    return chain([
      externalSchematic('@nrwl/node', 'lib', {
        ...schema,
        publishable: true,
        importPath: schema.importPath,
        unitTestRunner,
      }),
      addDepsToPackageJson(
        {},
        {
          '@nrwl/devkit': nxVersion,
          '@nrwl/node': nxVersion,
          tslib: '^2.0.0',
        }
      ),
      addFiles(options),
      updateWorkspaceJson(options),
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
