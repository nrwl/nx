import { chain } from '@angular-devkit/schematics';
import { formatFiles, updatePackagesInPackageJson } from '@nrwl/workspace';
import { join } from 'path';

export default function () {
  return chain([
    updatePackagesInPackageJson(
      join(__dirname, '../../../migrations.json'),
      '11.1.0'
    ),
    formatFiles(),
  ]);
}
