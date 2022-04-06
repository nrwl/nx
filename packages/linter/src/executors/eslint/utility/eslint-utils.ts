import { ESLint } from 'eslint';
import type { Schema } from '../schema';

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
    /**
     * If "noEslintrc" is set to `true` (and therefore here "useEslintrc" will be `false`), then ESLint will not
     * merge the provided config with others it finds automatically.
     */
    useEslintrc: !options.noEslintrc,
    overrideConfigFile: eslintConfigPath,
    ignorePath: options.ignorePath || undefined,
    fix: !!options.fix,
    cache: !!options.cache,
    cacheLocation: options.cacheLocation || undefined,
    cacheStrategy: options.cacheStrategy || undefined,
    resolvePluginsRelativeTo: options.resolvePluginsRelativeTo || undefined,
    rulePaths: options.rulesdir || [],
    /**
     * Default is `true` and if not overridden the eslint.lintFiles() method will throw an error
     * when no target files are found.
     *
     * We don't want ESLint to throw an error if a user has only just created
     * a project and therefore doesn't necessarily have matching files, for example.
     *
     * An angular generator creates lint pattern for `html` files, but there may
     * not be any html files in the project, so keeping it true would break linting everytime
     */
    errorOnUnmatchedPattern: false,
  });

  return await eslint.lintFiles(options.lintFilePatterns);
}
