import { runCLI } from 'jest';
import { readConfigs } from 'jest-config';
import { utils as jestReporterUtils } from '@jest/reporters';
import { makeEmptyAggregatedTestResult, addResult } from '@jest/test-result';
import * as path from 'path';
import { JestExecutorOptions } from './schema';
import { Config } from '@jest/types';
import { ExecutorContext, TaskGraph } from '@nrwl/devkit';
import { join } from 'path';
import { getSummary } from './summary';

try {
  require('dotenv').config();
} catch (e) {
  // noop
}

if (process.env.NODE_ENV === null || process.env.NODE_ENV === undefined) {
  (process.env as any).NODE_ENV = 'test';
}

export async function jestExecutor(
  options: JestExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const config = jestConfigParser(options, context);

  const { results } = await runCLI(config, [options.jestConfig]);

  return { success: results.success };
}

export function jestConfigParser(
  options: JestExecutorOptions,
  context: ExecutorContext,
  multiProjects = false
): Config.Argv {
  let jestConfig:
    | {
        transform: any;
        globals: any;
        setupFilesAfterEnv: any;
      }
    | undefined;

  if (!multiProjects) {
    options.jestConfig = path.resolve(context.root, options.jestConfig);

    jestConfig = require(options.jestConfig);
  }

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
  const configPaths = taskGraph.roots.reduce<string[]>((acc, root) => {
    acc.push(path.resolve(context.root, inputs[root].jestConfig));
    return acc;
  }, []);

  const { globalConfig, results } = await runCLI(
    jestConfigParser(overrides, context, true),
    [...configPaths]
  );

  const jestTaskExecutionResults: Record<
    string,
    { success: boolean; terminalOutput: string }
  > = {};

  for (let root of taskGraph.roots) {
    const aggregatedResults = makeEmptyAggregatedTestResult();
    aggregatedResults.startTime = results.startTime;

    const projectRoot = join(context.root, taskGraph.tasks[root].projectRoot);

    const config = await readConfigs({ $0: '', _: undefined }, [projectRoot]);

    let resultOutput = '';
    for (const testResult of results.testResults) {
      if (testResult.testFilePath.startsWith(projectRoot)) {
        addResult(aggregatedResults, testResult);
        resultOutput +=
          '\n\r' +
          jestReporterUtils.getResultHeader(
            testResult,
            globalConfig,
            config.configs[0]
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
