import { stripIndents } from '@nx/devkit';
import { lt } from 'semver';
import type { VersionInfo } from '../../executors/utilities/angular-version-utils';
import { getInstalledAngularVersionInfo } from '../../executors/utilities/angular-version-utils';
import type { Schema } from './schema';

export function validateOptions(options: Schema): void {
  const angularVersionInfo = getInstalledAngularVersionInfo();
  validateAssets(options, angularVersionInfo);
  validateBuildOptimizer(options, angularVersionInfo);
  validateBundleDependencies(options, angularVersionInfo);
  validateVendorChunk(options, angularVersionInfo);
}

function validateAssets(options: Schema, { version }: VersionInfo): void {
  if (
    lt(version, '15.1.0') &&
    Array.isArray(options.assets) &&
    options.assets.length > 0
  ) {
    throw new Error(stripIndents`The "assets" option is supported from Angular >= 15.1.0. You are currently using "${version}".
    You can resolve this error by removing the "assets" option or by migrating to Angular 15.1.0.`);
  }
}

function validateBuildOptimizer(
  options: Schema,
  { major, version }: VersionInfo
): void {
  if (major < 16 && options.buildOptimizer) {
    throw new Error(stripIndents`The "buildOptimizer" option is supported from Angular >= 16.0.0. You are currently using "${version}".
    You can resolve this error by removing the "buildOptimizer" option.`);
  }
}

function validateBundleDependencies(
  options: Schema,
  { major, version }: VersionInfo
): void {
  if (major >= 15 && options.bundleDependencies) {
    throw new Error(stripIndents`The "bundleDependencies" option was removed in Angular version 15. You are currently using "${version}".
    You can resolve this error by removing the "bundleDependencies" option.`);
  }
}

function validateVendorChunk(options: Schema, { version }: VersionInfo): void {
  if (lt(version, '15.1.0') && options.vendorChunk) {
    throw new Error(stripIndents`The "vendorChunk" option is supported from Angular >= 15.1.0. You are currently using "${version}".
    You can resolve this error by removing the "vendorChunk" option or by migrating to Angular 15.1.0.`);
  }
}
