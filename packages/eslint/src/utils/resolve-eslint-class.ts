import type { ESLint } from 'eslint';
import { useFlatConfig } from '../utils/flat-config';

export async function resolveESLintClass(opts?: {
  useFlatConfigOverrideVal: boolean;
}): Promise<typeof ESLint> {
  try {
    const shouldESLintUseFlatConfig =
      typeof opts?.useFlatConfigOverrideVal === 'boolean'
        ? opts.useFlatConfigOverrideVal
        : useFlatConfig();

    // `loadESLint` (added in eslint 8.57.0) resolves the correct ESLint class
    // for flat vs eslintrc config; it exists in every supported version (v9+).
    const eslintModule = (await import('eslint')) as typeof import('eslint') & {
      // Returns `typeof ESLint | typeof LegacyESLint`; the runtime classes are
      // interchangeable here, so cast to the simpler single-class public type.
      loadESLint: (opts: { useFlatConfig: boolean }) => Promise<typeof ESLint>;
    };

    return (await eslintModule.loadESLint({
      useFlatConfig: shouldESLintUseFlatConfig,
    })) as typeof ESLint;
  } catch {
    throw new Error(
      'Unable to find `eslint`. Ensure a valid `eslint` version is installed.'
    );
  }
}
