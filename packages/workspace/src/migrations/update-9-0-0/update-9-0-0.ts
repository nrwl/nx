import { chain } from '@angular-devkit/schematics';
import { updatePackagesInPackageJson } from '@nrwl/workspace';
import { join } from 'path';

const updatePackages = updatePackagesInPackageJson(
  join(__dirname, '../../../', 'migrations.json'),
  '9.0.0'
);

export default function() {
  return chain([updatePackages]);
}
