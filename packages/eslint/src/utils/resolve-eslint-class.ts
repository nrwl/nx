import type { ESLint } from 'eslint';
import { useFlatConfig } from '../utils/flat-config';

export async function resolveESLintClass(opts?: {
  useFlatConfigOverrideVal: boolean;
}): Promise<typeof ESLint> {
  try {
    // Explicitly use the FlatESLint and LegacyESLint classes here because the ESLint class points at a different one based on ESLint v8 vs ESLint v9
    // But the decision on which one to use is not just based on the major version of ESLint.
    // @ts-expect-error The may be wrong based on our installed eslint version
    const { LegacyESLint, FlatESLint } = await import(
      'eslint/use-at-your-own-risk'
    );

    const shouldESLintUseFlatConfig =
      typeof opts?.useFlatConfigOverrideVal === 'boolean'
        ? opts.useFlatConfigOverrideVal
        : useFlatConfig();

    return shouldESLintUseFlatConfig ? FlatESLint : LegacyESLint;
  } catch {
    throw new Error(
      'Unable to find `eslint`. Ensure a valid `eslint` version is installed.'
    );
  }
}
