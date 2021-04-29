import { Config } from '@jest/types';
import { ExecutorContext } from '@nrwl/devkit';
import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectTargetDependencies,
  createTmpJestConfig,
  createTmpTsConfig,
  DependentBuildableProjectNode,
  shouldUpdateDependencyPaths,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { runCLI } from 'jest';
import * as path from 'path';
import { JestExecutorOptions } from './schema';

try {
  require('dotenv').config();
} catch (e) {
  // noop
}

if (process.env.NODE_ENV === null || process.env.NODE_ENV === undefined) {
  (process.env as any).NODE_ENV = 'test';
}

let ts;

export async function jestExecutor(
  options: JestExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const config = jestConfigParser(options, context);

  const projectGraph = createProjectGraph();
  const { dependencies, target } = calculateProjectTargetDependencies(
    projectGraph,
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName
  );
  const shouldUpdatePaths = dependencies.some(shouldUpdateDependencyPaths);
  if (shouldUpdatePaths) {
    const jestConfig: Config.ProjectConfig = require(options.jestConfig);
    const rootDir = jestConfig.rootDir ?? path.dirname(options.jestConfig);
    const tmpTsConfigPath = updateTsConfigPaths(
      jestConfig,
      context.root,
      target.data.root,
      rootDir,
      dependencies
    );
    options.jestConfig = updateJestConfig(
      jestConfig,
      rootDir,
      context.root,
      target.data.root,
      tmpTsConfigPath,
      dependencies
    );
  }

  const { results } = await runCLI(config, [options.jestConfig]);

  return { success: results.success };
}

export function jestConfigParser(
  options: JestExecutorOptions,
  context: ExecutorContext
): Config.Argv {
  options.jestConfig = path.resolve(context.root, options.jestConfig);

  const jestConfig: {
    transform: any;
    globals: any;
    setupFilesAfterEnv: any;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
  } = require(options.jestConfig);

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
    colors: options.colors,
    verbose: options.verbose,
    testResultsProcessor: options.testResultsProcessor,
    updateSnapshot: options.updateSnapshot,
    useStderr: options.useStderr,
    watch: options.watch,
    watchAll: options.watchAll,
  };

  // for backwards compatibility
  if (options.setupFile) {
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

function getTsConfigPath(
  jestConfig: Config.ProjectConfig,
  workspaceRoot: string,
  projectRoot: string,
  jestRootDir: string
): string | undefined {
  let tsConfigPath = getTsJestTsConfigPath(jestConfig, jestRootDir);
  if (tsConfigPath) {
    return tsConfigPath;
  }

  const rootDir = path.join(workspaceRoot, projectRoot);
  ts = ts || require('typescript');
  tsConfigPath =
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.spec.json') ||
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.test.json') ||
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.jest.json');
  return tsConfigPath;
}

function getTsJestTsConfigPath(
  jestConfig: Config.ProjectConfig,
  rootDir: string
): string | undefined {
  return (jestConfig.globals?.['ts-jest'] as any)?.tsconfig?.replace(
    '<rootDir>',
    rootDir
  );
}

function updateJestConfig(
  jestConfig: Config.ProjectConfig,
  jestRootDir: string,
  workspaceRoot: string,
  projectRoot: string,
  tsConfigPath: string,
  dependencies: DependentBuildableProjectNode[]
): string {
  if (jestConfig.globals?.['ts-jest']) {
    (jestConfig.globals['ts-jest'] as any).tsconfig = tsConfigPath;
  }
  jestConfig.rootDir = jestRootDir;

  const outputs = dependencies
    .reduce((acc, current) => {
      acc.push(...current.outputs);
      return acc;
    }, [])
    .map((output: string) => {
      if (!output.startsWith('/')) {
        output = `/${output}`;
      }
      if (!output.endsWith('/')) {
        output = `${output}/`;
      }
      return output;
    });
  const uniqueOutputs = Array.from(new Set(outputs));
  jestConfig.transformIgnorePatterns = [
    ...(jestConfig.transformIgnorePatterns ?? [
      '/node_modules/',
      '\\.pnp\\.[^\\/]+$',
    ]),
    ...uniqueOutputs,
  ];

  return createTmpJestConfig(workspaceRoot, projectRoot, jestConfig);
}

function updateTsConfigPaths(
  jestConfig: Config.ProjectConfig,
  workspaceRoot: string,
  projectRoot: string,
  jestRootDir: string,
  dependencies: DependentBuildableProjectNode[]
): string {
  const tsConfigPath = getTsConfigPath(
    jestConfig,
    workspaceRoot,
    projectRoot,
    jestRootDir
  );

  if (!tsConfigPath) {
    throw new Error(
      `Cannot locate a tsconfig.spec.json. Please create one at ${projectRoot}/tsconfig.spec.json.`
    );
  }

  return createTmpTsConfig(
    tsConfigPath,
    workspaceRoot,
    projectRoot,
    dependencies
  );
}

export default jestExecutor;
