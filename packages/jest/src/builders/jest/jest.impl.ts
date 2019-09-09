import {
  BuilderContext,
  createBuilder,
  BuilderOutput
} from '@angular-devkit/architect';

import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import * as path from 'path';
import { JsonObject } from '@angular-devkit/core';

try {
  require('dotenv').config();
} catch (e) {}

import { runCLI } from 'jest';

export interface JestBuilderOptions extends JsonObject {
  codeCoverage?: boolean;
  config?: string;
  jestConfig: string;
  testFile?: string;
  setupFile?: string;
  tsConfig: string;
  bail?: number;
  ci?: boolean;
  color?: boolean;
  clearCache?: boolean;
  findRelatedTests?: string;
  json?: boolean;
  maxWorkers?: number;
  onlyChanged?: boolean;
  outputFile?: string;
  passWithNoTests?: boolean;
  runInBand?: boolean;
  silent?: boolean;
  testNamePattern?: string;
  testPathPattern?: string;
  colors?: boolean;
  reporters?: string[];
  verbose?: false;
  coverage?: false;
  coverageReporters?: string;
  coverageDirectory?: string;
  updateSnapshot?: boolean;
  useStderr?: boolean;
  watch?: boolean;
  watchAll?: boolean;
}

export default createBuilder<JestBuilderOptions>(run);

function run(
  options: JestBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  options.jestConfig = path.resolve(context.workspaceRoot, options.jestConfig);

  const tsJestConfig = {
    tsConfig: path.resolve(context.workspaceRoot, options.tsConfig),
    // Typechecking wasn't done in Jest 23 but is done in 24. This makes errors a warning to amend the breaking change for now
    // Remove for v8 to fail on type checking failure
    diagnostics: {
      warnOnly: true
    }
  };

  // TODO: This is hacky, We should probably just configure it in the user's workspace
  // If jest-preset-angular is installed, apply settings
  try {
    require.resolve('jest-preset-angular');
    Object.assign(tsJestConfig, {
      stringifyContentPathRegex: '\\.html$',
      astTransformers: ['jest-preset-angular/InlineHtmlStripStylesTransformer']
    });
  } catch (e) {}

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
    testNamePattern: options.testNamePattern,
    testPathPattern: options.testPathPattern,
    colors: options.colors,
    verbose: options.verbose,
    coverageReporters: options.coverageReporters,
    coverageDirectory: options.coverageDirectory,
    updateSnapshot: options.updateSnapshot,
    useStderr: options.useStderr,
    watch: options.watch,
    watchAll: options.watchAll,
    globals: JSON.stringify({
      'ts-jest': tsJestConfig
    })
  };

  if (options.setupFile) {
    config.setupFilesAfterEnv = [
      path.resolve(context.workspaceRoot, options.setupFile)
    ];
  }

  if (options.testFile) {
    config._.push(options.testFile);
  }

  if (options.findRelatedTests) {
    const parsedTests = options.findRelatedTests.split(',').map(s => s.trim());
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
    map(results => {
      return {
        success: results.results.success
      };
    })
  );
}
