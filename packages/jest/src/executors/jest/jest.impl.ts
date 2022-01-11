import 'dotenv/config';
import { runCLI } from 'jest';
import { readConfig } from 'jest-config';
import { utils as jestReporterUtils } from '@jest/reporters';
import { addResult, makeEmptyAggregatedTestResult } from '@jest/test-result';
import * as path from 'path';
import { join } from 'path';
import { JestExecutorOptions } from './schema';
import { Config } from '@jest/types';
import {
  ExecutorContext,
  offsetFromRoot,
  ProjectGraphProjectNode,
  readJsonFile,
  TaskGraph,
} from '@nrwl/devkit';
import { getSummary } from './summary';
import {
  createProjectGraphAsync,
  readCachedProjectGraph,
} from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';

process.env.NODE_ENV ??= 'test';

const createTmpJestConfig = (
  jestConfigPath: string,
  root: string,
  context: ExecutorContext,
  dependencies: DependentBuildableProjectNode[]
): string => {
  const jestConfig = readFileSync(
    path.resolve(context.cwd, jestConfigPath)
  ).toString();

  const overrides = createJestOverrides(root, context, dependencies);

  return `
    const path = require('path');
    const { pathsToModuleNameMapper } = require('ts-jest/utils')
    ${jestConfig}
    ${overrides}
  `;
};

/**
 * Attempt to find the compiled index.js to use as the entry point for this library
 *
 * Built in library schematics are as follows for the package.json index file:
 *
 * Nest: 'main'
 * Angular: 'esm2020', 'es2020', 'module' (No order, as of Angular 13 all three point to the same artifacts)
 * Node: 'main'
 * React: 'main', 'module' (Cannot use `module` as Jest does not support it yet)
 * TS (@nrwl/js): 'main'
 * Web: 'main'
 *
 * @param distPackageJson
 */
export function findIndexFile(distPackageJson: any): string | undefined {
  if (distPackageJson['main']) {
    return distPackageJson['main'];
  }

  return distPackageJson['esm2020'];
}

export function createJestOverrides(
  root: string,
  context: ExecutorContext,
  dependencies: DependentBuildableProjectNode[]
): string {
  const offset = offsetFromRoot(root);

  const tsAliasPrefix = `@${context.workspace.npmScope}/`;

  const paths = dependencies
    .filter((dep) => !dep.node.name.startsWith('npm:'))
    .reduce((prev, dep) => {
      const node = dep.node as ProjectGraphProjectNode;

      const rootPath = node.data.root.split('/');
      rootPath.shift();

      const distPackageJson = readJsonFile(
        path.join(context.cwd, 'dist', node.data.root, 'package.json')
      );

      const indexFile = findIndexFile(distPackageJson);

      if (!indexFile) {
        return prev;
      }

      return [
        ...prev,
        `"${tsAliasPrefix}${rootPath.join('/')}": [
          path.join(__dirname, '../${offset}dist/', '${
          node.data.root
        }', '${indexFile}')
        ]`,
      ];
    }, []);

  return `
  module.exports = {
    ...module.exports,
    preset: '${offset}jest.preset.js',
    rootDir: path.join(__dirname, '../${offset}${root}'),
    coverageDirectory: '../${offset}coverage/${root}',
    moduleNameMapper: {
      ...(module.exports.moduleNameMapper || {}),
      ...pathsToModuleNameMapper({
        ${paths.join(',')}
      })
    }
  }`;
}

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
    testPathIgnorePatterns: options.testPathIgnorePatterns,
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

  /*
   * Will enable jest to run tests using already compiled artifacts instead of
   * using ts-jest to compile the dependencies
   */
  if (!options.testFromSource && !options.watch && !options.watchAll) {
    // We only need to create the cached project graph if not testing from source
    await createProjectGraphAsync();
    const projGraph = readCachedProjectGraph();
    const { dependencies } = calculateProjectDependencies(
      projGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );

    const projectRoot = context.workspace.projects[context.projectName].root;

    const tmpProjectFolder = path.join(context.cwd, `tmp/${projectRoot}`);
    mkdirSync(tmpProjectFolder, { recursive: true });

    const temporaryJestConfig = createTmpJestConfig(
      options.jestConfig,
      projectRoot,
      context,
      dependencies
    );

    // Write the temporary jest config with correct paths
    writeFileSync(
      path.join(tmpProjectFolder, 'jest.config.js'),
      temporaryJestConfig,
      'utf8'
    );

    config.config = path.join(`tmp/${projectRoot}`, 'jest.config.js');
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
