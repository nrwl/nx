import type { ESLint } from 'eslint';

/**
 * A large number of out existing lint utils within generators are set up within deep stacks
 * of synchronous function calls, therefore for now while we need to check for both ESLint v8
 * and v9, we only provide a synchronous version of the function to avoid much a larger refactor.
 */
export function resolveESLintClassSync(useFlatConfig = false): typeof ESLint {
  try {
    // In eslint 8.57.0 (the final v8 version), a dedicated API was added for resolving the correct ESLint class.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const eslint = require('eslint');
    if (typeof eslint.loadESLint === 'function') {
      /**
       * Because we require this function to be synchronous, we have to bring over the implementation details
       * of loadESLint() ourselves, because it is an async function. Fortunately, it is very simple.
       */
      const shouldESLintUseFlatConfig =
        useFlatConfig ?? process.env.ESLINT_USE_FLAT_CONFIG !== 'false';
      const { LegacyESLint } = require('eslint/use-at-your-own-risk');
      return shouldESLintUseFlatConfig ? eslint.ESLint : LegacyESLint;
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
