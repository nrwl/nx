import { ExecutorContext } from '@nrwl/devkit';
import { ESLint } from 'eslint';

import { writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

import { Schema } from './schema';
import { lint, loadESLint } from './utility/eslint-utils';
import { createDirectory } from './utility/create-directory';

export default async function run(
  options: Schema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const systemRoot = context.root;
  process.chdir(context.cwd);

  const projectName = context.projectName || '<???>';
  const printInfo = options.format && !options.silent;

  if (printInfo) {
    console.info(`\nLinting ${JSON.stringify(projectName)}...`);
  }

  const projectESLint: { ESLint: typeof ESLint } = await loadESLint();
  const version = projectESLint.ESLint?.version?.split('.');
  if (
    !version ||
    version.length < 2 ||
    Number(version[0]) < 7 ||
    (Number(version[0]) === 7 && Number(version[1]) < 6)
  ) {
    throw new Error('ESLint must be version 7.6 or higher.');
  }

  const eslint = new projectESLint.ESLint({});

  /**
   * We want users to have the option of not specifying the config path, and let
   * eslint automatically resolve the `.eslintrc.json` files in each folder.
   */
  const eslintConfigPath = options.eslintConfig
    ? resolve(systemRoot, options.eslintConfig)
    : undefined;

  let lintResults: ESLint.LintResult[] = await lint(eslintConfigPath, options);

  if (lintResults.length === 0) {
    throw new Error('Invalid lint configuration. Nothing to lint.');
  }

  // if quiet, only show errors
  if (options.quiet) {
    console.debug('Quiet mode enabled - filtering out warnings\n');
    lintResults = ESLint.getErrorResults(lintResults);
  }

  const formatter = await eslint.loadFormatter(options.format);

  let totalErrors = 0;
  let totalWarnings = 0;

  // output fixes to disk, if applicable based on the options
  await projectESLint.ESLint.outputFixes(lintResults);

  for (const result of lintResults) {
    if (result.errorCount || result.warningCount) {
      totalErrors += result.errorCount;
      totalWarnings += result.warningCount;
    }
  }

  const formattedResults = formatter.format(lintResults);

  if (options.outputFile) {
    const pathToOutputFile = join(context.root, options.outputFile);
    createDirectory(dirname(pathToOutputFile));
    writeFileSync(pathToOutputFile, formattedResults);
  } else {
    console.info(formattedResults);
  }

  if (totalWarnings > 0 && printInfo) {
    console.warn('Lint warnings found in the listed files.\n');
  }

  if (totalErrors > 0 && printInfo) {
    console.error('Lint errors found in the listed files.\n');
  }

  if (totalWarnings === 0 && totalErrors === 0 && printInfo) {
    console.info('All files pass linting.\n');
  }

  return {
    success:
      options.force ||
      (totalErrors === 0 &&
        (options.maxWarnings === -1 || totalWarnings <= options.maxWarnings)),
  };
}
