import type { ESLint } from 'eslint';
import { gte } from 'semver';
import { isFlatConfig } from '../../../utils/config-file';
import { resolveESLintClass } from '../../../utils/resolve-eslint-class';
import type { Schema } from '../schema';

export async function resolveAndInstantiateESLint(
  eslintConfigPath: string | undefined,
  options: Schema,
  useFlatConfig = false
) {
  if (useFlatConfig && eslintConfigPath && !isFlatConfig(eslintConfigPath)) {
    throw new Error(
      // todo: add support for eslint.config.mjs,
      'When using the new Flat Config with ESLint, all configs must be named eslint.config.js or eslint.config.cjs and .eslintrc files may not be used. See https://eslint.org/docs/latest/use/configure/configuration-files'
    );
  }
  const ESLint = await resolveESLintClass({
    useFlatConfigOverrideVal: useFlatConfig,
  });

  // ruleFilter exist only in eslint 9+, remove this type when eslint 8 support dropped
  const eslintOptions: ESLint.Options & { ruleFilter?: Function } = {
    overrideConfigFile: eslintConfigPath,
    fix:
      !!options.fix &&
      (options.quiet ? (message) => message.severity === 2 : true),
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
    if (options.reportUnusedDisableDirectives) {
      throw new Error(
        'For Flat Config, ESLint removed `reportedUnusedDisableDirectives` and so it is not supported as an option. See https://eslint.org/docs/latest/use/configure/configuration-files-new'
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
    eslintOptions.reportUnusedDisableDirectives =
      options.reportUnusedDisableDirectives || undefined;
  }

  // pass --quiet to eslint 9+ directly: filter only errors
  if (options.quiet && gte(ESLint.version, '9.0.0')) {
    eslintOptions.ruleFilter = (rule) => rule.severity === 2;
  }

  const eslint = new ESLint(eslintOptions);

  return {
    ESLint,
    eslint,
  };
}
