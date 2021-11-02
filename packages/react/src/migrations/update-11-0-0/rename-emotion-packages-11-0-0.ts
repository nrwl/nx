import { chain } from '@angular-devkit/schematics';
import { formatFiles, renameNpmPackages } from '@nrwl/workspace';
import { emotionReactVersion } from '../../utils/versions';

export default function update() {
  return chain([
    renameNpmPackages({
      '@emotion/core': ['@emotion/react', emotionReactVersion],
    }),
    formatFiles(),
  ]);
}
