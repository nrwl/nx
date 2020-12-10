import { chain } from '@angular-devkit/schematics';
import { formatFiles } from '@nrwl/workspace';
import { moveNpmPackages } from '@nrwl/workspace/src/utils/rules/move-npm-packages';

export default function update() {
  return chain([
    moveNpmPackages({ toDevDeps: '@types/react-redux' }),
    formatFiles(),
  ]);
}
