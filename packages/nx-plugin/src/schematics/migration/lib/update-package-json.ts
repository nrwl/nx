import { Rule } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { NormalizedSchema } from '../schema';

export function updatePackageJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(
    path.join(options.projectRoot, 'package.json'),
    (json) => {
      if (!json['ng-update'] || !json['ng-update'].migrations) {
        if (json['ng-update']) {
          json['ng-update'].migrations = './migrations.json';
        } else {
          json['ng-update'] = {
            migrations: './migrations.json',
          };
        }
      }

      return json;
    }
  );
}
