import { formatFiles, updatePackagesInPackageJson } from '@nrwl/workspace';

import { join } from 'path';
import { chain } from '@angular-devkit/schematics';

export default () => {
  return chain([
    updatePackagesInPackageJson(
      join(__dirname, '../../../migrations.json'),
      '8.10.0'
    ),
    formatFiles(),
  ]);
};
