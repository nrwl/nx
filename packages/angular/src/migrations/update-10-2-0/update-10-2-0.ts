import { chain } from '@angular-devkit/schematics';
import {
  addUpdateTask,
  formatFiles,
  updatePackagesInPackageJson,
} from '@nrwl/workspace';
import { join } from 'path';

export default function () {
  return chain([
    addUpdateTask('@ngrx/store', '10.0.0'),
    updatePackagesInPackageJson(
      join(__dirname, '../../../migrations.json'),
      '10.2.0'
    ),
    formatFiles(),
  ]);
}
