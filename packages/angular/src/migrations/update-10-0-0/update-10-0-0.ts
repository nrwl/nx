import { chain } from '@angular-devkit/schematics';
import {
  addUpdateTask,
  formatFiles,
  updatePackagesInPackageJson,
} from '@nrwl/workspace';
import { join } from 'path';

export default function () {
  return chain([
    addUpdateTask('@angular/core', '10.0.0'),
    addUpdateTask('@angular/cli', '10.0.0'),
    updatePackagesInPackageJson(
      join(__dirname, '../../../migrations.json'),
      '10.0.0'
    ),
    formatFiles(),
  ]);
}
