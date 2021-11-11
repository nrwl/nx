import 'dotenv/config';
import { runCLI } from 'jest';
import { readConfig } from 'jest-config';
import { utils as jestReporterUtils } from '@jest/reporters';
import { makeEmptyAggregatedTestResult, addResult } from '@jest/test-result';
import * as path from 'path';
import { JestExecutorOptions } from './schema';
import { Config } from '@jest/types';
import {
  ExecutorContext,
  offsetFromRoot,
  ProjectGraphProjectNode,
  readJsonFile,
  TaskGraph,
} from '@nrwl/devkit';
import { join } from 'path';
import { getSummary } from './summary';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { mkdirSync, writeFileSync } from 'fs';

process.env.NODE_ENV ??= 'test';

const createTmpJestConfig = (projectName: string, root: string) => {
  const offset = offsetFromRoot(root);
  return `const path = require('path')
module.exports = {
  displayName: '${projectName}',
  preset: '${offset}jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/${offset}tmp/${root}tsconfig.spec.json'
    }
  },
  rootDir: path.join(__dirname, '../${offset}${root}'),
  testEnvironment: 'node',
  transform: {
    '^.+\\\\.[tj]s$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../${offset}coverage/${root}'
};
`;
};

const createTmpTsconfigSpecJson = (
  projectRoot: string,
  context: ExecutorContext,
  dependencies: DependentBuildableProjectNode[]
) => {
  const offset = offsetFromRoot(projectRoot);

  const sourcePath = `../${offset}${projectRoot}`;

  const tsConfig = readJsonFile(
    path.join(context.cwd, projectRoot, 'tsconfig.spec.json')
  );

  const tsAliasPrefix = `${context.workspace.npmScope}/`;

  tsConfig.extends = `${sourcePath}/tsconfig.json`;
  // Will override the includes array from
  // "include": ["**/*.test.ts", "**/*.spec.ts", "**/*.d.ts"]
  // to:
  // "include": ["../libs/lib1/**/*.test.ts", "../libs/lib1/**/*.spec.ts", "../libs/lib1/**/*.d.ts"]
  tsConfig.include = tsConfig.include.map(
    (includePath) => `${sourcePath}/${includePath}`
  );
  tsConfig.compilerOptions.paths = dependencies
    .filter((dep) => !dep.node.name.startsWith('npm:'))
    .reduce((prev, dep) => {
      const node = dep.node as ProjectGraphProjectNode;

      return {
        ...prev,
        // Will set the path alias for this dependency to something like: "@scope/lib1": ["../dist/libs/lib1"]
        [`${tsAliasPrefix}${node.data.root.replace(node.type, '')}`]: [
          `../${offset}${node.data.targets['build'].options['outputPath']}`,
        ],
      };
    }, {});

  return tsConfig;
};

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
  if (options.testWithArtifacts && !options.watch && !options.watchAll) {
    const projGraph = readCachedProjectGraph();
    const { dependencies } = calculateProjectDependencies(
      projGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );

    const projectRoot = context.workspace.projects[context.projectName].root;

    const temporaryJestConfig = createTmpJestConfig(
      context.projectName,
      projectRoot
    );

    const tmpProjectFolder = path.join(context.cwd, `tmp/${projectRoot}`);
    mkdirSync(tmpProjectFolder, { recursive: true });

    // Write the temporary jest config with correct paths
    writeFileSync(
      path.join(tmpProjectFolder, 'jest.config.js'),
      temporaryJestConfig,
      'utf8'
    );

    const temporaryTsConfig = createTmpTsconfigSpecJson(
      projectRoot,
      context,
      dependencies
    );

    // Write the temporary tsconfig spec json
    writeFileSync(
      path.join(tmpProjectFolder, `tsconfig.spec.json`),
      JSON.stringify(temporaryTsConfig),
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
