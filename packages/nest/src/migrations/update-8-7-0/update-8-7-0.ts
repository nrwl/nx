import { chain, Rule } from '@angular-devkit/schematics';
import { formatFiles, updatePackagesInPackageJson } from '@nrwl/workspace';
import * as path from 'path';

export default function update(): Rule {
  return chain([
    updatePackagesInPackageJson(
      path.join(__dirname, '../../../', 'migrations.json'),
      '8.7.0'
    ),
    formatFiles(),
  ]);
}
