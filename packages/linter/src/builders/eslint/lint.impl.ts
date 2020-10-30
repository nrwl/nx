import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import { createDirectory } from '@nrwl/workspace';
import { ESLint } from 'eslint';
import { writeFileSync } from 'fs';
import * as path from 'path';
import { Schema } from './schema';
import { lint, loadESLint } from './utility/eslint-utils';

async function run(
  options: Schema,
  context: BuilderContext
): Promise<BuilderOutput> {
  const systemRoot = context.workspaceRoot;
  process.chdir(context.currentDirectory);

  const projectName = context.target?.project || '<???>';
  const printInfo = options.format && !options.silent;

  context.reportStatus(`Linting ${JSON.stringify(projectName)}...`);
  if (printInfo) {
    context.logger.info(`\nLinting ${JSON.stringify(projectName)}...`);
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
    ? path.resolve(systemRoot, options.eslintConfig)
    : undefined;

  const lintResults: ESLint.LintResult[] = await lint(
    eslintConfigPath,
    options
  );

  if (lintResults.length === 0) {
    throw new Error('Invalid lint configuration. Nothing to lint.');
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
  context.logger.info(formattedResults);

  if (options.outputFile) {
    const pathToOutputFile = path.join(
      context.workspaceRoot,
      options.outputFile
    );
    createDirectory(path.dirname(pathToOutputFile));
    writeFileSync(pathToOutputFile, formattedResults);
  }

  if (totalWarnings > 0 && printInfo) {
    context.logger.warn('Lint warnings found in the listed files.\n');
  }

  if (totalErrors > 0 && printInfo) {
    context.logger.error('Lint errors found in the listed files.\n');
  }

  if (totalWarnings === 0 && totalErrors === 0 && printInfo) {
    context.logger.info('All files pass linting.\n');
  }

  return {
    success:
      options.force ||
      (totalErrors === 0 &&
        (options.maxWarnings === -1 || totalWarnings <= options.maxWarnings)),
  };
}

export default createBuilder(run);
