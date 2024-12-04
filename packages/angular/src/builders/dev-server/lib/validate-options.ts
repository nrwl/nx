import { stripIndents } from '@nx/devkit';
import { lt } from 'semver';
import { getInstalledAngularVersionInfo } from '../../../executors/utilities/angular-version-utils';
import type { Schema } from '../schema';

export function validateOptions(options: Schema): void {
  const { version: angularVersion } = getInstalledAngularVersionInfo();

  if (lt(angularVersion, '17.2.0') && options.prebundle) {
    throw new Error(stripIndents`The "prebundle" option is only supported in Angular >= 17.2.0. You are currently using "${angularVersion}".
      You can resolve this error by removing the "prebundle" option or by migrating to Angular 17.2.0.`);
  }

  if (lt(angularVersion, '18.1.0') && options.inspect) {
    throw new Error(stripIndents`The "inspect" option is only supported in Angular >= 18.1.0. You are currently using "${angularVersion}".
      You can resolve this error by removing the "inspect" option or by migrating to Angular 18.1.0.`);
  }
}
