import type { query } from '@phenomnomnominal/tsquery';
import type { getModifiers } from '@typescript-eslint/type-utils';
import type * as ts from 'typescript';

export const MISSING_TYPESCRIPT_MESSAGE =
  'Could not resolve the "typescript" package, which @nx/eslint-plugin needs to parse TypeScript sources. Install "typescript" in the workspace that runs ESLint.';

/**
 * `typescript`, `@typescript-eslint/type-utils` and `@phenomnomnominal/tsquery`
 * all read `typescript` at load time, so importing any of them eagerly makes
 * the plugin unloadable when the optional peer is absent.
 */
function requireTypescriptDependent<T>(packageName: string): T {
  try {
    require.resolve('typescript');
  } catch {
    throw new Error(MISSING_TYPESCRIPT_MESSAGE);
  }
  return require(packageName);
}

let tsModule: typeof ts;
export function loadTypescript(): typeof ts {
  return (tsModule ??= requireTypescriptDependent('typescript'));
}

let getModifiersFn: typeof getModifiers;
export function loadGetModifiers(): typeof getModifiers {
  return (getModifiersFn ??= requireTypescriptDependent<
    typeof import('@typescript-eslint/type-utils')
  >('@typescript-eslint/type-utils').getModifiers);
}

let queryFn: typeof query;
export function loadTsQuery(): typeof query {
  return (queryFn ??= requireTypescriptDependent<
    typeof import('@phenomnomnominal/tsquery')
  >('@phenomnomnominal/tsquery').query);
}
