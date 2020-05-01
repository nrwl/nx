import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import { runCLI } from 'jest';
import * as path from 'path';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { JestBuilderOptions } from './schema';

try {
  require('dotenv').config();
} catch (e) {}

if (process.env.NODE_ENV == null || process.env.NODE_ENV == undefined) {
  (process.env as any).NODE_ENV = 'test';
}

export default createBuilder<JestBuilderOptions>(run);

function run(
  options: JestBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  options.jestConfig = path.resolve(context.workspaceRoot, options.jestConfig);

  const jestConfig: {
    transform: any;
    globals: any;
  } = require(options.jestConfig);

  let transformers = Object.values<string>(jestConfig.transform || {});
  if (transformers.includes('babel-jest') && transformers.includes('ts-jest')) {
    throw new Error(
      'Using babel-jest and ts-jest together is not supported.\n' +
        'See ts-jest documentation for babel integration: https://kulshekhar.github.io/ts-jest/user/config/babelConfig'
    );
  }

  // use ts-jest by default
  const globals = jestConfig.globals || {};
  if (!transformers.includes('babel-jest')) {
    const tsJestConfig = {
      tsConfig: path.resolve(context.workspaceRoot, options.tsConfig),
    };

    // TODO: This is hacky, We should probably just configure it in the user's workspace
    // If jest-preset-angular is installed, apply settings
    try {
      require.resolve('jest-preset-angular');
      Object.assign(tsJestConfig, {
        stringifyContentPathRegex: '\\.(html|svg)$',
        astTransformers: [
          'jest-preset-angular/build/InlineFilesTransformer',
          'jest-preset-angular/build/StripStylesTransformer',
        ],
      });
    } catch (e) {}

    // merge the jestConfig globals with our 'ts-jest' override
    Object.assign(globals, {
      'ts-jest': {
        ...(globals['ts-jest'] || {}),
        ...tsJestConfig,
      },
    });
  }

  const config: any = {
    _: [],
    config: options.config,
    coverage: options.codeCoverage,
    bail: options.bail,
    ci: options.ci,
    color: options.color,
    json: options.json,
    maxWorkers: options.maxWorkers,
    onlyChanged: options.onlyChanged,
    outputFile: options.outputFile,
    passWithNoTests: options.passWithNoTests,
    runInBand: options.runInBand,
    silent: options.silent,
    testLocationInResults: options.testLocationInResults,
    testNamePattern: options.testNamePattern,
    testPathPattern: options.testPathPattern,
    colors: options.colors,
    verbose: options.verbose,
    coverageReporters: options.coverageReporters,
    coverageDirectory: options.coverageDirectory,
    testResultsProcessor: options.testResultsProcessor,
    updateSnapshot: options.updateSnapshot,
    useStderr: options.useStderr,
    watch: options.watch,
    watchAll: options.watchAll,
    globals: JSON.stringify(globals),
  };

  if (options.setupFile) {
    config.setupFilesAfterEnv = [
      path.resolve(context.workspaceRoot, options.setupFile),
    ];
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

  if (options.clearCache) {
    config.clearCache = true;
  }

  if (options.reporters && options.reporters.length > 0) {
    config.reporters = options.reporters;
  }

  return from(runCLI(config, [options.jestConfig])).pipe(
    map((results) => {
      return {
        success: results.results.success,
      };
    })
  );
}
