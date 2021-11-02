import 'dotenv/config';
import { runCLI } from 'jest';
import { readConfig } from 'jest-config';
import { utils as jestReporterUtils } from '@jest/reporters';
import { makeEmptyAggregatedTestResult, addResult } from '@jest/test-result';
import * as path from 'path';
import { JestExecutorOptions } from './schema';
import { Config } from '@jest/types';
import { ExecutorContext, TaskGraph } from '@nrwl/devkit';
import { join } from 'path';
import { getSummary } from './summary';

process.env.NODE_ENV ??= 'test';

export async function jestExecutor(
  options: JestExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const config = await jestConfigParser(options, context);

  const { results } = await runCLI(config, [options.jestConfig]);

  return { success: results.success };
}

export async function jestConfigParser(
  options: JestExecutorOptions,
  context: ExecutorContext,
  multiProjects = false
): Promise<Config.Argv> {
  let jestConfig:
    | {
        transform: any;
        globals: any;
        setupFilesAfterEnv: any;
      }
    | undefined;

  const config: Config.Argv = {
    $0: undefined,
    _: [],
    config: options.config,
    coverage: options.codeCoverage,
    bail: options.bail,
    ci: options.ci,
    color: options.color,
    detectOpenHandles: options.detectOpenHandles,
    json: options.json,
    maxWorkers: options.maxWorkers,
    onlyChanged: options.onlyChanged,
    changedSince: options.changedSince,
    outputFile: options.outputFile,
    passWithNoTests: options.passWithNoTests,
    runInBand: options.runInBand,
    showConfig: options.showConfig,
    silent: options.silent,
    testLocationInResults: options.testLocationInResults,
    testNamePattern: options.testNamePattern,
    testPathPattern: options.testPathPattern,
    testTimeout: options.testTimeout,
    colors: options.colors,
    verbose: options.verbose,
    testResultsProcessor: options.testResultsProcessor,
    updateSnapshot: options.updateSnapshot,
    useStderr: options.useStderr,
    watch: options.watch,
    watchAll: options.watchAll,
  };

  if (!multiProjects) {
    options.jestConfig = path.resolve(context.root, options.jestConfig);

    jestConfig = (await readConfig(config, options.jestConfig)).projectConfig;
  }

  // for backwards compatibility
  if (options.setupFile && !multiProjects) {
    const setupFilesAfterEnvSet = new Set([
      ...(jestConfig.setupFilesAfterEnv ?? []),
      path.resolve(context.root, options.setupFile),
    ]);
    config.setupFilesAfterEnv = Array.from(setupFilesAfterEnvSet);
  }

  if (options.testFile) {
    config._.push(options.testFile);
  }

  if (options.findRelatedTests) {
    const parsedTests = options.findRelatedTests
      .split(',')
      .map((s) => s.trim());
    config._.push(...parsedTests);
    config.findRelatedTests = true;
  }

  if (options.coverageDirectory) {
    config.coverageDirectory = path.join(
      context.root,
      options.coverageDirectory
    );
  }

  if (options.clearCache) {
    config.clearCache = true;
  }

  if (options.reporters && options.reporters.length > 0) {
    config.reporters = options.reporters;
  }

  if (
    Array.isArray(options.coverageReporters) &&
    options.coverageReporters.length > 0
  ) {
    config.coverageReporters = options.coverageReporters;
  }

  return config;
}

export default jestExecutor;

export async function batchJest(
  taskGraph: TaskGraph,
  inputs: Record<string, JestExecutorOptions>,
  overrides: JestExecutorOptions,
  context: ExecutorContext
): Promise<Record<string, { success: boolean; terminalOutput: string }>> {
  const configPaths = taskGraph.roots.map((root) =>
    path.resolve(context.root, inputs[root].jestConfig)
  );

  const { globalConfig, results } = await runCLI(
    await jestConfigParser(overrides, context, true),
    [...configPaths]
  );

  const jestTaskExecutionResults: Record<
    string,
    { success: boolean; terminalOutput: string }
  > = {};

  const configs = await Promise.all(
    configPaths.map(async (path) => readConfig({ $0: '', _: undefined }, path))
  );

  for (let i = 0; i < taskGraph.roots.length; i++) {
    let root = taskGraph.roots[i];
    const aggregatedResults = makeEmptyAggregatedTestResult();
    aggregatedResults.startTime = results.startTime;

    const projectRoot = join(context.root, taskGraph.tasks[root].projectRoot);

    let resultOutput = '';
    for (const testResult of results.testResults) {
      if (testResult.testFilePath.startsWith(projectRoot)) {
        addResult(aggregatedResults, testResult);
        resultOutput +=
          '\n\r' +
          jestReporterUtils.getResultHeader(
            testResult,
            globalConfig,
            configs[i].projectConfig
          );
      }
    }
    aggregatedResults.numTotalTestSuites = aggregatedResults.testResults.length;

    jestTaskExecutionResults[root] = {
      success: aggregatedResults.numFailedTests === 0,
      terminalOutput: resultOutput + '\n\r\n\r' + getSummary(aggregatedResults),
    };
  }

  return jestTaskExecutionResults;
}
