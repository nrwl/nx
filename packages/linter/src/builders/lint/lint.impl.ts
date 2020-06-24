import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { CLIEngine } from 'eslint';
import { writeFileSync } from 'fs';
import * as path from 'path';
import { Schema } from './schema';
import { createProgram } from './utility/ts-utils';
import { lint, loadESLint } from './utility/eslint-utils';
import { createDirectory } from '@nrwl/workspace';

/**
 * Adapted from @angular-eslint/builder source
 */
async function run(options: Schema, context: BuilderContext): Promise<any> {
  if (options.linter === 'tslint') {
    throw new Error(
      `'tslint' option is no longer supported. Update your angular.json to use "@angular-eslint/builder:lint" builder directly.`
    );
  }

  const systemRoot = context.workspaceRoot;
  process.chdir(context.currentDirectory);
  const projectName = (context.target && context.target.project) || '<???>';

  const printInfo = options.format && !options.silent;

  context.reportStatus(`Linting ${JSON.stringify(projectName)}...`);
  if (printInfo) {
    context.logger.info(`\nLinting ${JSON.stringify(projectName)}...`);
  }

  const projectESLint = await loadESLint();
  const version =
    (projectESLint.Linter as any).version &&
    (projectESLint.Linter as any).version.split('.');
  if (
    !version ||
    version.length < 2 ||
    Number(version[0]) < 6 ||
    (Number(version[0]) === 6 && Number(version[1]) < 1)
  ) {
    throw new Error('ESLint must be version 6.1 or higher.');
  }

  // We want users to have the option of not specifying the config path, and let
  // eslint automatically resolve the `.eslintrc` files in each folder.
  const eslintConfigPath = options.config
    ? path.resolve(systemRoot, options.config)
    : undefined;

  let lintReports: CLIEngine.LintReport[] = [];
  const lintedFiles = new Set<string>();

  if (options.tsConfig) {
    const tsConfigs: string[] = Array.isArray(options.tsConfig)
      ? options.tsConfig
      : [options.tsConfig];
    context.reportProgress(0, tsConfigs.length);
    const allPrograms = tsConfigs.map((tsConfig: any) =>
      createProgram(path.resolve(systemRoot, tsConfig))
    );

    let i = 0;
    for (const program of allPrograms) {
      lintReports = [
        ...lintReports,
        ...(await lint(
          systemRoot,
          eslintConfigPath,
          options,
          lintedFiles,
          program,
          allPrograms
        )),
      ];
      context.reportProgress(++i, allPrograms.length);
    }
  } else {
    lintReports = [
      ...lintReports,
      ...(await lint(systemRoot, eslintConfigPath, options, lintedFiles)),
    ];
  }

  if (lintReports.length === 0) {
    throw new Error('Invalid lint configuration. Nothing to lint.');
  }

  const formatter: CLIEngine.Formatter = (projectESLint.CLIEngine as any).getFormatter(
    options.format
  );

  const bundledReport: CLIEngine.LintReport = {
    errorCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0,
    warningCount: 0,
    results: [],
    usedDeprecatedRules: [],
  };
  for (const report of lintReports) {
    // output fixes to disk
    projectESLint.CLIEngine.outputFixes(report);

    if (report.errorCount || report.warningCount) {
      bundledReport.errorCount += report.errorCount;
      bundledReport.warningCount += report.warningCount;
      bundledReport.fixableErrorCount += report.fixableErrorCount;
      bundledReport.fixableWarningCount += report.fixableWarningCount;
      bundledReport.results.push(...report.results);
      bundledReport.usedDeprecatedRules.push(...report.usedDeprecatedRules);
    }
  }

  const formattedResults = formatter(bundledReport.results);
  context.logger.info(formattedResults);

  if (options.outputFile) {
    const pathToFile = path.join(context.workspaceRoot, options.outputFile);
    createDirectory(path.dirname(pathToFile));
    writeFileSync(pathToFile, formattedResults);
  }
  if (bundledReport.warningCount > 0 && printInfo) {
    context.logger.warn('Lint warnings found in the listed files.\n');
  }

  if (bundledReport.errorCount > 0 && printInfo) {
    context.logger.error('Lint errors found in the listed files.\n');
  }

  if (
    bundledReport.warningCount === 0 &&
    bundledReport.errorCount === 0 &&
    printInfo
  ) {
    context.logger.info('All files pass linting.\n');
  }

  return {
    success:
      options.force ||
      (bundledReport.errorCount === 0 &&
        (options.maxWarnings === -1 ||
          bundledReport.warningCount < options.maxWarnings)),
  };
}

export default createBuilder<any>(run);
