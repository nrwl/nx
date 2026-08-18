import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import {
  minSupportedExpressVersion,
  minSupportedFastifyVersion,
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
  }
}
