import { Rule } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { NormalizedSchema } from '../schema';

export function updateMigrationsJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(
    path.join(options.projectRoot, 'migrations.json'),
    (json) => {
      if (json.schematics) {
        json.generators = json.schematics;
        delete json.schematics;
      }

      const generators = json.generators ? json.generators : {};
      generators[options.name] = {
        version: options.version,
        description: options.description,
        cli: 'nx',
        implementation: `./src/migrations/${options.name}/${options.name}`,
      };
      json.generators = generators;

      if (options.packageJsonUpdates) {
        const packageJsonUpdatesObj = json.packageJsonUpdates
          ? json.packageJsonUpdates
          : {};
        if (!packageJsonUpdatesObj[options.version]) {
          packageJsonUpdatesObj[options.version] = {
            version: options.version,
            packages: {},
          };
        }
        json.packageJsonUpdates = packageJsonUpdatesObj;
      }

      return json;
    }
  );
}
