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

  const hasSuppressionOptions =
    options.suppressAll ||
    (options.suppressRule && options.suppressRule.length > 0) ||
    options.suppressionsLocation ||
    options.pruneSuppressions;

  if (hasSuppressionOptions && ESLint.version && !gte(ESLint.version, '9.24.0')) {
    throw new Error(
      'Bulk suppression options (suppressAll, suppressRule, suppressionsLocation, pruneSuppressions) require ESLint v9.24.0 or higher. Current version: ' +
        (ESLint.version || 'unknown')
    );
  }

  const eslintVersion = ESLint.version;
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
    eslintOptions.useEslintrc = !options.noEslintrc;
    eslintOptions.reportUnusedDisableDirectives =
      options.reportUnusedDisableDirectives || undefined;
  }

  if (options.quiet && gte(ESLint.version, '9.0.0')) {
    eslintOptions.ruleFilter = (rule) => rule.severity === 2;
  }

  // For ESLint v10+, pass applySuppressions so the programmatic API handles suppression.
  // suppressAll/suppressRule (writing suppressions) remain post-lint for all versions.
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

export function getSuppressionsFilePath(
  suppressionsLocation: string | undefined,
  cwd: string
): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SuppressionsService } = require('eslint/lib/services/suppressions-service') as {
      SuppressionsService: { DEFAULT_SUPPRESSIONS_FILENAME: string };
    };
    const defaultName = SuppressionsService.DEFAULT_SUPPRESSIONS_FILENAME;
    // Use the provided location or default filename
    const location = suppressionsLocation || defaultName;
    return require('path').resolve(cwd, location);
  } catch {
    return require('path').resolve(cwd, 'eslint-suppressions.json');
  }
}

export async function applySuppressions(
  results: ESLint.LintResult[],
  context: SuppressionsContext
): Promise<SuppressionsResult> {
  const path = await import('path');

  // Mutually exclusive validation
  if (context.suppressAll && context.suppressRule && context.suppressRule.length > 0) {
    throw new Error('The suppressAll option and the suppressRule option cannot be used together.');
  }
  if (context.suppressAll && context.pruneSuppressions) {
    throw new Error('The suppressAll option and the pruneSuppressions option cannot be used together.');
  }
  if (context.suppressRule && context.suppressRule.length > 0 && context.pruneSuppressions) {
    throw new Error('The suppressRule option and the pruneSuppressions option cannot be used together.');
  }

  let SuppressionsService: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    SuppressionsService = (require('eslint/lib/services/suppressions-service') as {
      SuppressionsService: any;
    }).SuppressionsService;
  } catch {
    // Fallback: try to resolve from the ESLint package location
    try {
      const eslintPath = require.resolve('eslint');
      const eslintDir = path.dirname(eslintPath);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      SuppressionsService = require(path.join(eslintDir, 'services', 'suppressions-service')).SuppressionsService;
    } catch {
      throw new Error(
        'Could not resolve SuppressionsService from the installed ESLint package. ' +
        'Ensure ESLint v9.24.0 or higher is installed.'
      );
    }
  }

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
