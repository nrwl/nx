import { Rule } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { NormalizedSchema } from '../schema';

export function updateMigrationsJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(
    path.join(options.projectRoot, 'migrations.json'),
    (json) => {
      const schematics = json.schematics ? json.schematics : {};
      schematics[options.name] = {
        version: options.version,
        description: options.description,
        factory: `./src/migrations/${options.name}/${options.name}`,
      };
      json.schematics = schematics;

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
