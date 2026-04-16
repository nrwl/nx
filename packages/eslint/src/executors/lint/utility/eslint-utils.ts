import { existsSync } from 'fs';
import type { ESLint } from 'eslint';
import { gte } from 'semver';
import { isFlatConfig } from '../../../utils/config-file';
import { resolveESLintClass } from '../../../utils/resolve-eslint-class';
import type { Schema } from '../schema';

export interface SuppressionsContext {
  suppressAll: boolean;
  suppressRule: string[] | undefined;
  suppressionsLocation: string | undefined;
  pruneSuppressions: boolean;
  cwd: string;
}

export interface SuppressionsResult {
  results: ESLint.LintResult[];
  unusedSuppressions: Record<string, any>;
}

/**
 * Resolve the ESLint class, validate version requirements for suppression features,
 * and instantiate an ESLint instance with the appropriate options.
 *
 * Version handling:
 * - ESLint v9.24.0+: supports suppressAll, suppressRule, suppressionsLocation via constructor.
 *   However, the v9 programmatic API silently ignores these options, so suppression
 *   application must be handled post-lint via SuppressionsService (see applySuppressions below).
 * - ESLint v10.0.0+: supports applySuppressions via constructor, which causes lintFiles()
 *   to automatically apply suppressions from the suppressions file during linting.
 *   Writing new suppressions (suppressAll/suppressRule) and pruning still happen post-lint.
 */
export async function resolveAndInstantiateESLint(
  eslintConfigPath: string | undefined,
  options: Schema,
  useFlatConfig = false
) {
  if (useFlatConfig && eslintConfigPath && !isFlatConfig(eslintConfigPath)) {
    throw new Error(
      'When using the new Flat Config with ESLint, all configs must be named eslint.config.js or eslint.config.cjs and .eslintrc files may not be used. See https://eslint.org/docs/latest/use/configure/configuration-files'
    );
  }
  const ESLint = await resolveESLintClass({
    useFlatConfigOverrideVal: useFlatConfig,
  });

  // Validate version requirements early, before doing any other work.
  // Fail early with a clear error message if the user is using suppression features
  // with an ESLint version that doesn't support them.
  const hasSuppressionOptions =
    options.suppressAll ||
    (options.suppressRule && options.suppressRule.length > 0) ||
    options.suppressionsLocation ||
    options.pruneSuppressions;

  if (
    hasSuppressionOptions &&
    ESLint.version &&
    !gte(ESLint.version, '9.24.0')
  ) {
    throw new Error(
      'Bulk suppression options (suppressAll, suppressRule, suppressionsLocation, pruneSuppressions) require ESLint v9.24.0 or higher. Current version: ' +
        (ESLint.version || 'unknown')
    );
  }

  const eslintVersion = ESLint?.version;
  const isEslintV10 = eslintVersion && gte(eslintVersion, '10.0.0');

  // Use the broader legacy options shape so the v8 (legacy-only) fields assigned
  // below type-check. Flat-only fields (ruleFilter, suppress*) are intersected
  // in; they're ignored at runtime by legacy ESLint and are version-gated below.
  const eslintOptions: ESLint.LegacyOptions & {
    ruleFilter?: Function;
    applySuppressions?: boolean;
    suppressionsLocation?: string;
  } = {
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
     * not be any html files in the project, so keeping it true would break linting every time.
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

  // pass --quiet to ESLint 9+ directly: filter to only errors
  if (options.quiet && gte(ESLint.version, '9.0.0')) {
    eslintOptions.ruleFilter = (rule) => rule.severity === 2;
  }

  // For ESLint v10+, pass applySuppressions so the programmatic API handles suppression
  // automatically during lintFiles(). Writing new suppressions (suppressAll/suppressRule)
  // and pruning remain post-lint operations for all versions.
  if (isEslintV10) {
    eslintOptions.applySuppressions = true;
    if (options.suppressionsLocation) {
      eslintOptions.suppressionsLocation = options.suppressionsLocation;
    }
  }

  // Runtime ESLint class may be the flat or legacy implementation; the built
  // options object is compatible with either at runtime, but the two Options
  // shapes diverge in v9 types so cast at the boundary.
  const eslint = new ESLint(eslintOptions as ESLint.Options);

  return {
    ESLint,
    eslint,
    isEslintV10: !!isEslintV10,
  };
}

/**
 * Resolve the path to the suppressions file.
 *
 * Tries to read the default filename from ESLint's SuppressionsService to stay
 * in sync with ESLint's own default. Falls back to 'eslint-suppressions.json' if
 * SuppressionsService cannot be resolved (e.g., ESLint < 9.24.0).
 *
 * NOTE: This reaches into ESLint internals (eslint/lib/services/suppressions-service).
 * The internal path could change between ESLint versions without notice.
 */
export function getSuppressionsFilePath(
  suppressionsLocation: string | undefined,
  cwd: string
): string {
  const path = require('path') as typeof import('path');

  // If the user explicitly provided a location, use it directly
  if (suppressionsLocation) {
    return path.resolve(cwd, suppressionsLocation);
  }

  // Otherwise, try to read the default filename from ESLint's SuppressionsService
  // to stay in sync with ESLint's own default.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SuppressionsService } =
      require('eslint/lib/services/suppressions-service') as {
        SuppressionsService: { DEFAULT_SUPPRESSIONS_FILENAME: string };
      };
    const defaultName = SuppressionsService.DEFAULT_SUPPRESSIONS_FILENAME;
    return path.resolve(cwd, defaultName);
  } catch {
    return path.resolve(cwd, 'eslint-suppressions.json');
  }
}

/**
 * Apply bulk suppressions to lint results using ESLint's SuppressionsService.
 *
 * This is needed because:
 * - ESLint v9.x: the programmatic API (new ESLint({ suppressAll: true })) silently
 *   ignores suppression options. We must call SuppressionsService directly to
 *   write suppressions, prune unused entries, and apply existing suppressions to results.
 * - ESLint v10.x: lintFiles() applies suppressions automatically when `applySuppressions: true`
 *   is passed to the constructor, but writing (suppressAll/suppressRule) and pruning still
 *   need to be done post-lint via this function.
 *
 * NOTE: This uses ESLint's internal SuppressionsService API
 * (eslint/lib/services/suppressions-service). The methods suppress(), prune(), load(),
 * and applySuppressions() are not part of ESLint's public API and could change.
 */
export async function applySuppressions(
  results: ESLint.LintResult[],
  context: SuppressionsContext
): Promise<SuppressionsResult> {
  const path = await import('path');

  validateSuppressionOptions(context);

  const SuppressionsService = resolveSuppressionsService(path);

  const suppressionsFilePath = getSuppressionsFilePath(
    context.suppressionsLocation,
    context.cwd
  );

  if (
    context.suppressionsLocation &&
    !existsSync(suppressionsFilePath) &&
    !context.suppressAll &&
    !(context.suppressRule && context.suppressRule.length > 0)
  ) {
    throw new Error(
      'The suppressions file does not exist. Please run the command with `suppressAll` or `suppressRule` to create it.'
    );
  }

  const shouldWriteSuppressions =
    context.suppressAll ||
    (context.suppressRule && context.suppressRule.length > 0);

  const shouldPrune = context.pruneSuppressions;

  const hasSuppressionsFile = existsSync(suppressionsFilePath);

  if (!shouldWriteSuppressions && !shouldPrune && !hasSuppressionsFile) {
    return { results, unusedSuppressions: {} };
  }

  const suppressions = new SuppressionsService({
    filePath: suppressionsFilePath,
    cwd: context.cwd,
  });

  if (shouldWriteSuppressions) {
    await suppressions.suppress(results, context.suppressRule);
  }

  if (shouldPrune) {
    await suppressions.prune(results);
  }

  const suppressionResults = suppressions.applySuppressions(
    results,
    await suppressions.load()
  );

  return {
    results: suppressionResults.results,
    unusedSuppressions: suppressionResults.unused,
  };
}

/**
 * Validate that mutually exclusive suppression options are not used together.
 * These constraints mirror ESLint's CLI behavior.
 */
export function validateSuppressionOptions(context: SuppressionsContext): void {
  if (
    context.suppressAll &&
    context.suppressRule &&
    context.suppressRule.length > 0
  ) {
    throw new Error(
      'The suppressAll option and the suppressRule option cannot be used together.'
    );
  }
  if (context.suppressAll && context.pruneSuppressions) {
    throw new Error(
      'The suppressAll option and the pruneSuppressions option cannot be used together.'
    );
  }
  if (
    context.suppressRule &&
    context.suppressRule.length > 0 &&
    context.pruneSuppressions
  ) {
    throw new Error(
      'The suppressRule option and the pruneSuppressions option cannot be used together.'
    );
  }
}

/**
 * Resolve ESLint's internal SuppressionsService class.
 *
 * Tries the direct internal path first, then falls back to resolving from
 * the ESLint package location. Throws a clear error if neither works.
 */
export function resolveSuppressionsService(path: typeof import('path')): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (
      require('eslint/lib/services/suppressions-service') as {
        SuppressionsService: any;
      }
    ).SuppressionsService;
  } catch {
    // Fallback: try to resolve from the ESLint package location
    try {
      const eslintPath = require.resolve('eslint');
      const eslintDir = path.dirname(eslintPath);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require(path.join(eslintDir, 'services', 'suppressions-service'))
        .SuppressionsService;
    } catch {
      throw new Error(
        'Could not resolve SuppressionsService from the installed ESLint package. ' +
          'Ensure ESLint v9.24.0 or higher is installed.'
      );
    }
  }
}
