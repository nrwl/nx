import { Rule } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { NormalizedSchema } from '../schema';

export function updatePackageJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(
    path.join(options.projectRoot, 'package.json'),
    (json) => {
      if (!json['nx-migrations'] || !json['nx-migrations'].migrations) {
        if (json['nx-migrations']) {
          json['nx-migrations'].migrations = './migrations.json';
        } else {
          json['nx-migrations'] = {
            migrations: './migrations.json',
          };
        }
      }

      return json;
    }
  );
}
