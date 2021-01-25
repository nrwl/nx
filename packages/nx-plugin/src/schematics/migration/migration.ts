import { chain, Rule, Tree } from '@angular-devkit/schematics';
import { addFiles } from './lib/add-files';
import { normalizeOptions } from './lib/normalize-options';
import { updateMigrationsJson } from './lib/update-migrations-json';
import { updatePackageJson } from './lib/update-package-json';
import { updateWorkspaceJson } from './lib/update-workspace-json';
import { NormalizedSchema } from './schema';

export default function (schema: NormalizedSchema): Rule {
  return (host: Tree) => {
    const options = normalizeOptions(host, schema);

    return chain([
      addFiles(options),
      updateMigrationsJson(options),
      updateWorkspaceJson(options),
      updatePackageJson(options),
    ]);
  };
}
