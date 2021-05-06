import { chain, Rule } from '@angular-devkit/schematics';
import { formatFiles } from '@nrwl/workspace/src/utils/rules/format-files';
import * as path from 'path';
import { updatePackagesInPackageJson } from '../../utils/update-packages-in-package-json';

export default function (): Rule {
  return chain([
    updatePackagesInPackageJson(
      path.join(__dirname, '../../..', 'migrations.json'),
      '8120'
    ),
    formatFiles(),
  ]);
}
