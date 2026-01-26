import { stripIndents } from '@nx/devkit';
import { getInstalledAngularVersionInfo } from '../../../executors/utilities/angular-version-utils';
import type { Schema } from '../schema';

export function validateOptions(options: Schema): void {
  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo();

  if (angularMajorVersion < 21) {
    if (options.define && Object.keys(options.define).length > 0) {
      throw new Error(stripIndents`The "define" option is only supported in Angular >= 21.0.0. You are currently using "${angularVersion}".
        You can resolve this error by removing the "define" option or by migrating to Angular 21.0.0.`);
    }
  }
}
