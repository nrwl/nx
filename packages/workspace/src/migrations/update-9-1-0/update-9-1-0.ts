import { chain } from '@angular-devkit/schematics';
import { formatFiles, updatePackagesInPackageJson } from '@nrwl/workspace';
import { join } from 'path';

const updatePackages = updatePackagesInPackageJson(
  join(__dirname, '../../../', 'migrations.json'),
  '9.1.0'
);
export default function () {
  return chain([updatePackages, formatFiles()]);
}
