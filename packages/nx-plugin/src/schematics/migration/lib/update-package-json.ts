import { Rule } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { NormalizedSchema } from '../schema';

export function updatePackageJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(
    path.join(options.projectRoot, 'package.json'),
    (json) => {
      if (!json['nx-migrate'] || !json['nx-migrate'].migrations) {
        if (json['nx-migrate']) {
          json['nx-migrate'].migrations = './migrations.json';
        } else {
          json['nx-migrate'] = {
            migrations: './migrations.json',
          };
        }
      }

      return json;
    }
  );
}
