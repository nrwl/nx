import { getFilesToLint } from './file-utils';
import type { Schema } from '../schema';
import { CLIEngine } from 'eslint';

/**
 * Copied from @angular-eslint/builder source
 */

export async function loadESLint() {
  let eslint;
  try {
    eslint = await import('eslint');
    return eslint;
  } catch {
    throw new Error('Unable to find ESLint. Ensure ESLint is installed.');
  }
}

/**
 * Adapted from @angular-eslint/builder source
 */

export async function lint(
  systemRoot: string,
  eslintConfigPath: string,
  options: Schema,
  lintedFiles: Set<string>,
  program?: any,
  allPrograms?: any[]
): Promise<any[]> {
  const files = getFilesToLint(systemRoot, options, program);

  const projectESLint = await loadESLint();
  const cli: CLIEngine = new projectESLint.CLIEngine({
    configFile: eslintConfigPath,
    useEslintrc: true,
    fix: !!options.fix,
    cache: !!options.cache,
    cacheLocation: options.cacheLocation,
  });

  const lintReports: CLIEngine.LintReport[] = [];

  for (const file of files) {
    if (program && allPrograms) {
      // If it cannot be found in ANY program, then this is an error.
      if (allPrograms.every((p) => p.getSourceFile(file) === undefined)) {
        throw new Error(
          `File ${JSON.stringify(file)} is not part of a TypeScript project '${
            options.tsConfig
          }'.`
        );
      } else if (program.getSourceFile(file) === undefined) {
        // The file exists in some other programs. We will lint it later (or earlier) in the loop.
        continue;
      }
    }

    // Already linted the current file, so skip it here...
    if (lintedFiles.has(file)) {
      continue;
    }

    // Give some breathing space to other promises that might be waiting.
    await Promise.resolve();
    const report = cli.executeOnFiles([file]);
    if (options.quiet) {
      report.results = CLIEngine.getErrorResults(report.results);
      report.errorCount = 0;
    }
    lintReports.push(report);
    lintedFiles.add(file);
  }

  return lintReports;
}
