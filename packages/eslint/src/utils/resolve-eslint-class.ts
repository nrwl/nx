import type { ESLint } from 'eslint';

export async function resolveESLintClass(
  useFlatConfig = false
): Promise<typeof ESLint> {
  try {
    // In eslint 8.57.0 (the final v8 version), a dedicated API was added for resolving the correct ESLint class.
    const eslint = await import('eslint');
    if (typeof (eslint as any).loadESLint === 'function') {
      return await (eslint as any).loadESLint({ useFlatConfig });
    }
    // If that API is not available (an older version of v8), we need to use the old way of resolving the ESLint class.
    if (!useFlatConfig) {
      return eslint.ESLint;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FlatESLint } = require('eslint/use-at-your-own-risk');
    return FlatESLint;
  } catch {
    throw new Error('Unable to find ESLint. Ensure ESLint is installed.');
  }
}
