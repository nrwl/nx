import { chain } from '@angular-devkit/schematics';
import { addUpdateTask, formatFiles } from '@nrwl/workspace';

export default function () {
  return chain([
    addUpdateTask('@angular/core', '10.0.0'),
    addUpdateTask('@angular/cli', '10.0.0'),
    formatFiles(),
  ]);
}
