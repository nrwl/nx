import { chain } from '@angular-devkit/schematics';
import { formatFiles, renameNpmPackages } from '@nrwl/workspace';
import { emotionServerVersion } from '../../utils/versions';

export default function update() {
  return chain([
    renameNpmPackages({
      'emotion-server': ['@emotion/server', emotionServerVersion],
    }),
    formatFiles(),
  ]);
}
