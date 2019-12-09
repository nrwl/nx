import { Rule } from '@angular-devkit/schematics';
import { updatePackagesInPackageJson } from '@nrwl/workspace';
import * as path from 'path';

export default function update(): Rule {
  return updatePackagesInPackageJson(
    path.join(__dirname, '../../../', 'migrations.json'),
    '8.10.0'
  );
}
