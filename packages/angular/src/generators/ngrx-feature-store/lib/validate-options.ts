import type { Tree } from '@nx/devkit';
import { Schema } from '../schema';
import {
  getInstalledAngularVersionInfo,
  getInstalledPackageVersionInfo,
} from '../..//utils/version-utils';
import { getPkgVersionForAngularMajorVersion } from '../../../utils/version-utils';
import { coerce, lt, major } from 'semver';
import { tsquery } from '@phenomnomnominal/tsquery';

export function validateOptions(tree: Tree, options: Schema): void {
  if (!options.parent) {
    throw new Error('Please provide a value for "--parent"!');
  }

  if (options.parent && !tree.exists(options.parent)) {
    throw new Error(`Parent does not exist: ${options.parent}.`);
  }

  const angularVersionInfo = getInstalledAngularVersionInfo(tree);
  const intendedNgRxVersionForAngularMajor =
    getPkgVersionForAngularMajorVersion(
      'ngrxVersion',
      angularVersionInfo.major
    );

  const ngrxMajorVersion =
    getInstalledPackageVersionInfo(tree, '@ngrx/store')?.major ??
    major(coerce(intendedNgRxVersionForAngularMajor));

  if (lt(angularVersionInfo.version, '14.1.0') || ngrxMajorVersion < 15) {
    const parentContent = tree.read(options.parent, 'utf-8');
    const { tsquery } = require('@phenomnomnominal/tsquery');
    const ast = tsquery.ast(parentContent);

    const NG_MODULE_DECORATOR_SELECTOR =
      'ClassDeclaration > Decorator > CallExpression:has(Identifier[name=NgModule])';
    const nodes = tsquery(ast, NG_MODULE_DECORATOR_SELECTOR, {
      visitAllChildren: true,
    });
    if (nodes.length === 0) {
      throw new Error(
        `The provided parent path "${options.parent}" does not contain an "NgModule". ` +
          'Please make sure to provide a path to an "NgModule" where the state will be registered. ' +
          'If you are trying to use a "Routes" definition file (for Standalone API usage), ' +
          'please note this is not supported in Angular versions lower than 14.1.0.'
      );
    }
  }
}
