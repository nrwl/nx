import type { Tree } from '@nx/devkit';
import { clean, coerce, major } from 'semver';
import { getInstalledNestJsVersion, nestJsVersion } from './versions';

const firstEsmOnlyNestJsMajor = 12;

// An unparseable range (workspace:, catalog:) falls back to the latest major,
// like `versions()` does.
function getNestJsMajor(tree: Tree): number {
  const declared = getInstalledNestJsVersion(tree);
  const version = declared && (clean(declared) ?? coerce(declared)?.version);
  return major(version || coerce(nestJsVersion)!.version);
}

/**
 * Nest 12 ships `@nestjs/testing` as ESM only, which the generated jest setup
 * fails to load (`SyntaxError: Unexpected token 'export'`).
 */
export function getDefaultUnitTestRunner(tree: Tree): 'jest' | 'vitest' {
  return getNestJsMajor(tree) >= firstEsmOnlyNestJsMajor ? 'vitest' : 'jest';
}

export function assertJestSupported(tree: Tree): void {
  if (getDefaultUnitTestRunner(tree) === 'jest') {
    return;
  }

  throw new Error(
    `Using jest with @nx/nest requires Nest ${firstEsmOnlyNestJsMajor - 1} or earlier, but this workspace uses Nest ${firstEsmOnlyNestJsMajor}.\n` +
      `The jest setup that Nx generates cannot load @nestjs/testing ${firstEsmOnlyNestJsMajor}, which is ESM only, so the generated specs fail to run.\n` +
      `Generate with "--unitTestRunner=vitest".`
  );
}
