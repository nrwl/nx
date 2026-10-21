import type { Tree } from '@nx/devkit';
import { coerce, major } from 'semver';
import { getInstalledNestJsVersion, nestJsVersion } from './versions';

const firstEsmOnlyNestJsMajor = 12;

// A missing or unresolvable version (e.g. `workspace:`) falls back to the
// latest major, like `versions()` does.
function getNestJsMajor(tree: Tree): number {
  return major(
    getInstalledNestJsVersion(tree) ?? coerce(nestJsVersion)!.version
  );
}

/**
 * Nest 12 ships `@nestjs/testing` as ESM only, which the generated jest setup
 * fails to load (`SyntaxError: Unexpected token 'export'`).
 */
export function getDefaultUnitTestRunner(tree: Tree): 'jest' | 'vitest' {
  return getNestJsMajor(tree) >= firstEsmOnlyNestJsMajor ? 'vitest' : 'jest';
}

export function assertJestSupported(tree: Tree): void {
  const nestJsMajor = getNestJsMajor(tree);
  if (nestJsMajor < firstEsmOnlyNestJsMajor) {
    return;
  }

  throw new Error(
    `Using jest with @nx/nest requires Nest ${firstEsmOnlyNestJsMajor - 1} or earlier, but this workspace uses Nest ${nestJsMajor}.\n` +
      `The jest setup that Nx generates cannot load @nestjs/testing ${firstEsmOnlyNestJsMajor} or later, which is ESM only, so the generated specs fail to run.\n` +
      `Generate with "--unitTestRunner=vitest", or add "@nestjs/core@^${firstEsmOnlyNestJsMajor - 1}.0.0" to the workspace first to keep jest.`
  );
}
