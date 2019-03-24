import {
  Builder,
  BuildEvent,
  BuilderConfiguration,
  BuilderContext
} from '@angular-devkit/architect';

import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

import * as path from 'path';

try {
  require('dotenv').config();
} catch (e) {}

const { runCLI } = require('jest');

export interface JestBuilderOptions {
  jestConfig: string;
  tsConfig: string;
  watch: boolean;
  bail?: boolean;
  ci?: boolean;
  codeCoverage?: boolean;
  onlyChanged?: boolean;
  maxWorkers?: number;
  passWithNoTests?: boolean;
  runInBand?: boolean;
  setupFile?: string;
  silent?: boolean;
  updateSnapshot?: boolean;
  testNamePattern?: string;
  reporters?: string;
}

export default class JestBuilder implements Builder<JestBuilderOptions> {
  run(
    builderConfig: BuilderConfiguration<JestBuilderOptions>
  ): Observable<BuildEvent> {
    const options = builderConfig.options;
    const tsJestConfig = {
      tsConfig: path.join(
        '<rootDir>',
        path.relative(builderConfig.root, options.tsConfig)
      )
    };

    // TODO: This is hacky, We should probably just configure it in the user's workspace
    // If jest-preset-angular is installed, apply settings
    try {
      require.resolve('jest-preset-angular');
      Object.assign(tsJestConfig, {
        stringifyContentPathRegex: '\\.html$',
        astTransformers: [
          'jest-preset-angular/InlineHtmlStripStylesTransformer'
        ]
      });
    } catch (e) {}
    const config: any = {
      watch: options.watch,
      coverage: options.codeCoverage,
      bail: options.bail,
      ci: options.ci,
      updateSnapshot: options.updateSnapshot,
      onlyChanged: options.onlyChanged,
      passWithNoTests: options.passWithNoTests,
      silent: options.silent,
      runInBand: options.runInBand,
      globals: JSON.stringify({
        'ts-jest': tsJestConfig
      })
    };

    if (options.maxWorkers) {
      config.maxWorkers = options.maxWorkers;
    }

    if (options.testNamePattern) {
      config.testNamePattern = options.testNamePattern;
    }

    if (options.setupFile) {
      config.setupTestFrameworkScriptFile = path.join(
        '<rootDir>',
        path.relative(builderConfig.root, options.setupFile)
      );
    }

    if (options.reporters) {
      try {
        const reporters = JSON.parse(options.reporters);
        config.reporters = reporters;
      } catch (e) {
        config.reporters = [options.reporters];
      }
    }

    return from(runCLI(config, [options.jestConfig])).pipe(
      map((results: any) => {
        return {
          success: results.results.success
        };
      })
    );
  }
}
