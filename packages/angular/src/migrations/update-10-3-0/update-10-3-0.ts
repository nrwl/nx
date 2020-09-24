import { chain } from '@angular-devkit/schematics';
import { formatFiles, updatePackagesInPackageJson } from '@nrwl/workspace';
import { join } from 'path';

export default function () {
  return chain([
    updatePackagesInPackageJson(
      join(__dirname, '../../../migrations.json'),
      '10.3.0'
    ),
    formatFiles(),
  ]);
}
