import type { Tree } from '@nx/devkit';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema): void {
  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);

  if (options.changeDetection === 'Eager' && angularMajorVersion < 22) {
    throw new Error(
      `The "Eager" change detection strategy is only supported for Angular versions >= 22.0.0. You are using Angular ${angularVersion}.`
    );
  }
}
