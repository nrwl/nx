import { chain } from '@angular-devkit/schematics';
import { updatePackagesInPackageJson } from '../../utils/update-packages-in-package-json';
import { join } from 'path';

import { formatFiles } from '../../utils/rules/format-files';

const updatePackages = updatePackagesInPackageJson(
  join(__dirname, '../../..', 'migrations.json'),
  '11.0.0'
);

export default function () {
  return chain([updatePackages, formatFiles()]);
}
