import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import {
  minSupportedExpressVersion,
  minSupportedFastifyVersion,
  minSupportedFulmineVersion,
  minSupportedKoaVersion,
} from './versions';

export function assertSupportedExpressVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'express', minSupportedExpressVersion);
}

export function assertSupportedKoaVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'koa', minSupportedKoaVersion);
}

export function assertSupportedFastifyVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'fastify', minSupportedFastifyVersion);
}

export function assertSupportedFulmineVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    'fulmine.js',
    minSupportedFulmineVersion
  );
}

export function assertSupportedFrameworkVersion(
  tree: Tree,
  framework: string | undefined
): void {
  if (framework === 'express') {
    assertSupportedExpressVersion(tree);
  } else if (framework === 'koa') {
    assertSupportedKoaVersion(tree);
  } else if (framework === 'fastify') {
    assertSupportedFastifyVersion(tree);
  } else if (framework === 'fulmine') {
    assertSupportedFulmineVersion(tree);
  }
}
