import { ExecutorContext, joinPathFragments, workspaceRoot } from '@nx/devkit';
import { ESLint } from 'eslint';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

import type { Schema } from './schema';
import { resolveAndInstantiateESLint } from './utility/eslint-utils';
import { interpolate } from 'nx/src/tasks-runner/utils';

export default async function run(
  options: Schema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  // this is only used for the hasher
  delete options.hasTypeAwareRules;

  const systemRoot = context.root;

  // eslint resolves files relative to the current working directory.
  // We want these paths to always be resolved relative to the workspace
  // root to be able to run the lint executor from any subfolder.
  process.chdir(systemRoot);

  const projectName = context.projectName || '<???>';
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  const printInfo = options.format && !options.silent;

  if (printInfo) {
    console.info(`\nLinting ${JSON.stringify(projectName)}...`);
  }

  options.cacheLocation = options.cacheLocation
    ? joinPathFragments(options.cacheLocation, projectName)
    : undefined;

  const { printConfig, errorOnUnmatchedPattern, ...normalizedOptions } =
    options;

  /**
   * Until ESLint v9 is released and the new so called flat config is the default
   * we only want to support it if the user has explicitly opted into it by converting
   * their root ESLint config to use eslint.config.js
   */
  const hasFlatConfig = existsSync(
    joinPathFragments(workspaceRoot, 'eslint.config.js')
  );

  // while standard eslint uses by default closest config to the file, if otherwise not specified,
  // the flat config would always use the root config, so we need to explicitly set it to the local one
  if (hasFlatConfig && !normalizedOptions.eslintConfig) {
    const eslintConfigPath = joinPathFragments(projectRoot, 'eslint.config.js');
    if (existsSync(eslintConfigPath)) {
      normalizedOptions.eslintConfig = eslintConfigPath;
    }
  }

  /**
   * We want users to have the option of not specifying the config path, and let
   * eslint automatically resolve the `.eslintrc.json` files in each folder.
   */
  let eslintConfigPath = normalizedOptions.eslintConfig
    ? resolve(systemRoot, normalizedOptions.eslintConfig)
    : undefined;

  const { eslint, ESLint } = await resolveAndInstantiateESLint(
    eslintConfigPath,
    normalizedOptions,
    hasFlatConfig
  );

  const version = ESLint.version?.split('.');
  if (
    !version ||
    version.length < 2 ||
    Number(version[0]) < 7 ||
    (Number(version[0]) === 7 && Number(version[1]) < 6)
  ) {
    throw new Error('ESLint must be version 7.6 or higher.');
  }

  if (printConfig) {
    try {
      const fileConfig = await eslint.calculateConfigForFile(printConfig);
      console.log(JSON.stringify(fileConfig, null, ' '));
      return {
        success: true,
      };
    } catch (err) {
      console.error(err);
      return {
        success: false,
      };
    }
  }

  let lintResults: ESLint.LintResult[] = [];

  const normalizedLintFilePatterns = normalizedOptions.lintFilePatterns.map(
    (pattern) => {
      return interpolate(pattern, {
        workspaceRoot: '',
        projectRoot,
        projectName: context.projectName,
      });
    }
  );
  try {
    lintResults = await eslint.lintFiles(normalizedLintFilePatterns);
  } catch (err) {
    if (
      err.message.includes(
        'You must therefore provide a value for the "parserOptions.project" property for @typescript-eslint/parser'
      )
    ) {
      const ruleName = err.message.match(/rule '([^']+)':/)?.[1];
      let eslintConfigPathForError = `for ${projectName}`;
      if (context.projectsConfigurations?.projects?.[projectName]?.root) {
        const { root } = context.projectsConfigurations.projects[projectName];
        eslintConfigPathForError = `\`${root}/.eslintrc.json\``;
      }

      console.error(`
Error: You have attempted to use ${
        ruleName ? `the lint rule ${ruleName}` : 'a lint rule'
      } which requires the full TypeScript type-checker to be available, but you do not have \`parserOptions.project\` configured to point at your project tsconfig.json files in the relevant TypeScript file "overrides" block of your project ESLint config ${
        eslintConfigPath || eslintConfigPathForError
      }

Please see https://nx.dev/guides/eslint for full guidance on how to resolve this issue.
`);

      return {
        success: false,
      };
    }
    // If some unexpected error, rethrow
    throw err;
  }

  if (lintResults.length === 0 && errorOnUnmatchedPattern) {
    const ignoredPatterns = (
      await Promise.all(
        normalizedLintFilePatterns.map(async (pattern) =>
          (await eslint.isPathIgnored(pattern)) ? pattern : null
        )
      )
    )
      .filter((pattern) => !!pattern)
      .map((pattern) => `- '${pattern}'`);
    if (ignoredPatterns.length) {
      const ignoreSection = hasFlatConfig
        ? `'ignores' configuration`
        : `'.eslintignore' file`;
      throw new Error(
        `All files matching the following patterns are ignored:\n${ignoredPatterns.join(
          '\n'
        )}\n\nPlease check your ${ignoreSection}.`
      );
    }
    throw new Error(
      'Invalid lint configuration. Nothing to lint. Please check your lint target pattern(s).'
    );
  }

  // output fixes to disk, if applicable based on the options
  await ESLint.outputFixes(lintResults);

  // if quiet, only show errors
  if (normalizedOptions.quiet) {
    console.debug('Quiet mode enabled - filtering out warnings\n');
    lintResults = ESLint.getErrorResults(lintResults);
  }

  const formatter = await eslint.loadFormatter(normalizedOptions.format);

  const formattedResults = await formatter.format(lintResults);

  if (normalizedOptions.outputFile) {
    const pathToOutputFile = joinPathFragments(
      context.root,
      normalizedOptions.outputFile
    );
    mkdirSync(dirname(pathToOutputFile), { recursive: true });
    writeFileSync(pathToOutputFile, formattedResults);
  } else {
    console.info(formattedResults);
  }

  const totals = getTotals(lintResults);

  if (printInfo) {
    outputPrintInfo(totals);
  }

  return {
    success:
      normalizedOptions.force ||
      (totals.errors === 0 &&
        (normalizedOptions.maxWarnings === -1 ||
          totals.warnings <= normalizedOptions.maxWarnings)),
  };
}

function getTotals(lintResults: ESLint.LintResult[]) {
  let errors = 0;
  let warnings = 0;
  let fixableErrors = 0;
  let fixableWarnings = 0;

  for (const result of lintResults) {
    errors += result.errorCount || 0;
    warnings += result.warningCount || 0;
    fixableErrors += result.fixableErrorCount || 0;
    fixableWarnings += result.fixableWarningCount || 0;
  }

  return {
    errors,
    warnings,
    fixableErrors,
    fixableWarnings,
  };
}

function pluralizedOutput(word: string, count: number) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function outputPrintInfo({
  errors,
  warnings,
  fixableErrors,
  fixableWarnings,
}: ReturnType<typeof getTotals>) {
  const total = warnings + errors;
  const totalFixable = fixableErrors + fixableWarnings;

  if (total <= 0) {
    console.info('\u2714 All files pass linting\n');
    return;
  }

  console.info(
    `\u2716 ${pluralizedOutput('problem', total)} (${pluralizedOutput(
      'error',
      errors
    )}, ${pluralizedOutput('warning', warnings)})\n`
  );
  if (totalFixable <= 0) return;
  console.info(
    `  ${pluralizedOutput('error', fixableErrors)} and ${pluralizedOutput(
      'warning',
      fixableWarnings
    )} are potentially fixable with the \`--fix\` option.\n`
  );
}
