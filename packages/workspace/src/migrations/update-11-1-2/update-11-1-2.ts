import { chain } from '@angular-devkit/schematics';
import { formatFiles, updatePackagesInPackageJson } from '@nrwl/workspace';
import { join } from 'path';

const updatePackages = updatePackagesInPackageJson(
  join(__dirname, '../../../', 'migrations.json'),
  '11.1.2'
);

export default function () {
  return chain([updatePackages, formatFiles()]);
}
