import { ESLint } from 'eslint';
import { Schema } from '../schema';

export async function loadESLint() {
  let eslint;
  try {
    eslint = await import('eslint');
    return eslint;
  } catch {
    throw new Error('Unable to find ESLint. Ensure ESLint is installed.');
  }
}

export async function lint(
  eslintConfigPath: string | undefined,
  options: Schema
): Promise<ESLint.LintResult[]> {
  const projectESLint: { ESLint: typeof ESLint } = await loadESLint();

  const eslint = new projectESLint.ESLint({
    useEslintrc: true,
    overrideConfigFile: eslintConfigPath,
    ignorePath: options.ignorePath || undefined,
    fix: !!options.fix,
    cache: !!options.cache,
    cacheLocation: options.cacheLocation || undefined,
    /**
     * Default is `true` and if not overridden the eslint.lintFiles() method will throw an error
     * when no target files are found.
     *
     * We don't want ESLint to throw an error if a user has only just created
     * a project and therefore doesn't necessarily have matching files, for example.
     */
    errorOnUnmatchedPattern: false,
  });

  if (options.quiet) {
    return await eslint
      .lintFiles(options.lintFilePatterns)
      .then((results) => projectESLint.ESLint.getErrorResults(results));
  }

  return await eslint.lintFiles(options.lintFilePatterns);
}
