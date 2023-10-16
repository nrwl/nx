import type { ESLint } from 'eslint';
import type { Schema } from '../schema';

async function resolveESLintClass(
  useFlatConfig = false
): Promise<typeof ESLint> {
  try {
    if (!useFlatConfig) {
      return (await import('eslint')).ESLint;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FlatESLint } = require('eslint/use-at-your-own-risk');
    return FlatESLint;
  } catch {
    throw new Error('Unable to find ESLint. Ensure ESLint is installed.');
  }
}

export async function resolveAndInstantiateESLint(
  eslintConfigPath: string | undefined,
  options: Schema,
  useFlatConfig = false
) {
  if (
    useFlatConfig &&
    eslintConfigPath &&
    !eslintConfigPath?.endsWith('eslint.config.js')
  ) {
    throw new Error(
      'When using the new Flat Config with ESLint, all configs must be named eslint.config.js and .eslintrc files may not be used. See https://eslint.org/docs/latest/use/configure/configuration-files-new'
    );
  }
  const ESLint = await resolveESLintClass(useFlatConfig);

  const eslintOptions: ESLint.Options = {
    overrideConfigFile: eslintConfigPath,
    fix: !!options.fix,
    cache: !!options.cache,
    cacheLocation: options.cacheLocation || undefined,
    cacheStrategy: options.cacheStrategy || undefined,
    /**
     * Default is `true` and if not overridden the eslint.lintFiles() method will throw an error
     * when no target files are found.
     *
     * We don't want ESLint to throw an error if a user has only just created
     * a project and therefore doesn't necessarily have matching files, for example.
     *
     * Also, the angular generator creates a lint pattern for `html` files, but there may
     * not be any html files in the project, so keeping it true would break linting every time
     */
    errorOnUnmatchedPattern: false,
    reportUnusedDisableDirectives:
      options.reportUnusedDisableDirectives || undefined,
  };

  if (useFlatConfig) {
    if (typeof options.useEslintrc !== 'undefined') {
      throw new Error(
        'For Flat Config, the `useEslintrc` option is not applicable. See https://eslint.org/docs/latest/use/configure/configuration-files-new'
      );
    }
    if (options.resolvePluginsRelativeTo !== undefined) {
      throw new Error(
        'For Flat Config, ESLint removed `resolvePluginsRelativeTo` and so it is not supported as an option. See https://eslint.org/docs/latest/use/configure/configuration-files-new'
      );
    }
    if (options.ignorePath !== undefined) {
      throw new Error(
        'For Flat Config, ESLint removed `ignorePath` and so it is not supported as an option. See https://eslint.org/docs/latest/use/configure/configuration-files-new'
      );
    }
  } else {
    eslintOptions.rulePaths = options.rulesdir || [];
    eslintOptions.resolvePluginsRelativeTo =
      options.resolvePluginsRelativeTo || undefined;
    eslintOptions.ignorePath = options.ignorePath || undefined;
    /**
     * If "noEslintrc" is set to `true` (and therefore here "useEslintrc" will be `false`), then ESLint will not
     * merge the provided config with others it finds automatically.
     */
    eslintOptions.useEslintrc = !options.noEslintrc;
  }

  const eslint = new ESLint(eslintOptions);

  return {
    ESLint,
    eslint,
  };
}
