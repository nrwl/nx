import type { Tree } from '@nx/devkit';
import { addReadyWhenSignalToTargets } from '@nx/devkit/internal';

export default async function update(tree: Tree) {
  return addReadyWhenSignalToTargets(tree, [
    '@angular/build:dev-server',
    '@angular-devkit/build-angular:dev-server',
    '@angular-devkit/build-angular:ssr-dev-server',
    '@nx/angular:dev-server',
  ]);
}
