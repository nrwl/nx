import {
  Builder,
  BuildEvent,
  BuilderConfiguration
} from '@angular-devkit/architect';

import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

import * as path from 'path';

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
}

export default class JestBuilder implements Builder<JestBuilderOptions> {
  run(
    builderConfig: BuilderConfiguration<JestBuilderOptions>
  ): Observable<BuildEvent> {
    const options = builderConfig.options;
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
        'ts-jest': {
          tsConfigFile: path.relative(builderConfig.root, options.tsConfig)
        },
        __TRANSFORM_HTML__: true
      })
    };

    if (options.maxWorkers) {
      config.maxWorkers = options.maxWorkers;
    }

    if (options.setupFile) {
      config.setupTestFrameworkScriptFile = path.join(
        '<rootDir>',
        path.relative(builderConfig.root, options.setupFile)
      );
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
