import type { Tree } from '@nx/devkit';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { Schema } from '../schema';

export function validateOptions(tree: Tree, options: Schema) {
  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);

  if (angularMajorVersion < 21) {
    if (options.zoneless !== undefined) {
      throw new Error(
        `The "zoneless" option is only supported for Angular versions >= 21.0.0. You are using Angular ${angularVersion}.`
      );
    }
  }
}
