import {
  Builder,
  BuildEvent,
  BuilderConfiguration
} from '@angular-devkit/architect';

import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

import * as path from 'path';

import { runCLI as runJest } from 'jest';

export interface JestBuilderOptions {
  jestConfig: string;
  tsConfig: string;
  watch: boolean;
  ci?: boolean;
  codeCoverage?: boolean;
  setupFile?: string;
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
      ci: options.ci,
      updateSnapshot: options.updateSnapshot,
      globals: JSON.stringify({
        'ts-jest': {
          tsConfigFile: path.relative(builderConfig.root, options.tsConfig)
        },
        __TRANSFORM_HTML__: true
      })
    };

    if (options.setupFile) {
      config.setupTestFrameworkScriptFile = path.join(
        '<rootDir>',
        path.relative(builderConfig.root, options.setupFile)
      );
    }

    return from(runJest(config, [options.jestConfig])).pipe(
      map((results: any) => {
        return {
          success: results.results.success
        };
      })
    );
  }
}
