import {
  Builder,
  BuilderConfiguration,
  BuilderContext,
  BuildEvent
} from '@angular-devkit/architect';
import { Observable, of, Subscriber, noop } from 'rxjs';
import { catchError, concatMap, tap, map, take } from 'rxjs/operators';
import { ChildProcess, fork } from 'child_process';
import { copySync, removeSync } from 'fs-extra';
import { fromPromise } from 'rxjs/internal-compatibility';
import { readFile } from '@angular-devkit/schematics/tools/file-system-utility';
import { getSystemPath, join } from '@angular-devkit/core';
import * as path from 'path';
import * as url from 'url';
import * as treeKill from 'tree-kill';
const Cypress = require('cypress'); // @NOTE: Importing via ES6 messes the whole test dependencies.

export interface CypressBuilderOptions {
  baseUrl: string;
  cypressConfig: string;
  devServerTarget: string;
  headless: boolean;
  exit: boolean;
  parallel: boolean;
  record: boolean;
  key?: string;
  tsConfig: string;
  watch: boolean;
  browser?: string;
}

try {
  require('dotenv').config();
} catch (e) {}

/**
 * @whatItDoes Implementation of the Cypress Builder, compile Typescript files,
 * build the devServer to serve the app then run Cypress e2e test runner.
 * The builder needs some information from the `angular.json` file:
 * @example:
```
 "my-app-e2e": {
    "root": "apps/my-app-e2e/",
    "projectType": "application",
    "architect": {
      "e2e": {
        "builder": "@nrwl/cypress:cypress",
        "options": {
          "cypressConfig": "apps/my-app-e2e/cypress.json",
          "tsConfig": "apps/my-app-e2e/tsconfig.json",
          "devServerTarget": "my-app:serve"
      },
      "configurations": {
        "production": {
          "devServerTarget": "my-app:serve:production"
        }
      }
      }
    }
 }
```
 *
 */
export default class CypressBuilder implements Builder<CypressBuilderOptions> {
  private computedCypressBaseUrl: string;
  private tscProcess: ChildProcess = null;

  constructor(public context: BuilderContext) {}

  /**
   * @whatItDoes This is the starting point of the builder.
   * @param builderConfig
   */
  run(
    builderConfig: BuilderConfiguration<CypressBuilderOptions>
  ): Observable<BuildEvent> {
    const options = builderConfig.options;
    const tsconfigJson = JSON.parse(readFile(options.tsConfig));

    // Cleaning the /dist folder
    removeSync(
      path.join(
        path.dirname(options.tsConfig),
        tsconfigJson.compilerOptions.outDir
      )
    );

    return this.compileTypescriptFiles(options.tsConfig, options.watch).pipe(
      tap(() =>
        this.copyCypressFixtures(options.tsConfig, options.cypressConfig)
      ),
      concatMap(() =>
        !options.baseUrl && options.devServerTarget
          ? this.startDevServer(options.devServerTarget, options.watch)
          : of(null)
      ),
      concatMap(() =>
        this.initCypress(
          options.cypressConfig,
          options.headless,
          options.exit,
          options.record,
          options.key,
          options.parallel,
          options.watch,
          options.baseUrl,
          options.browser
        )
      ),
      options.watch ? tap(noop) : take(1),
      catchError(error => {
        throw new Error(error);
      })
    );
  }

  /**
   * @whatItDoes Compile typescript spec files to be able to run Cypress.
   * The compilation is done via executing the `tsc` command line/
   * @param tsConfigPath
   * @param isWatching
   */
  private compileTypescriptFiles(
    tsConfigPath: string,
    isWatching: boolean
  ): Observable<BuildEvent> {
    if (this.tscProcess) {
      this.killProcess();
    }
    return Observable.create((subscriber: Subscriber<BuildEvent>) => {
      try {
        let args = ['-p', tsConfigPath];
        const tscPath = getSystemPath(
          join(this.context.workspace.root, '/node_modules/typescript/bin/tsc')
        );
        if (isWatching) {
          args.push('--watch');
          this.tscProcess = fork(tscPath, args, { stdio: [0, 1, 2, 'ipc'] });
          subscriber.next({ success: true });
        } else {
          this.tscProcess = fork(tscPath, args, { stdio: [0, 1, 2, 'ipc'] });
          this.tscProcess.on('exit', code => {
            subscriber.next({ success: code === 0 });
            subscriber.complete();
          });
        }
      } catch (error) {
        if (this.tscProcess) {
          this.killProcess();
        }
        subscriber.error(
          new Error(`Could not compile Typescript files: \n ${error}`)
        );
      }
    });
  }

  /**
   * @whatItDoes Copy all the fixtures into the dist folder.
   * This is done because `tsc` doesn't handle `json` files.
   * @param tsConfigPath
   */
  private copyCypressFixtures(tsConfigPath: string, cypressConfigPath: string) {
    const cypressConfig = JSON.parse(readFile(cypressConfigPath));
    // DOn't copy fixtures if cypress config does not have it set
    if (!cypressConfig.fixturesFolder) {
      return;
    }

    copySync(
      `${path.dirname(tsConfigPath)}/src/fixtures`,
      path.join(path.dirname(cypressConfigPath), cypressConfig.fixturesFolder),
      { overwrite: true }
    );
  }

  /**
   * @whatItDoes Initialize the Cypress test runner with the provided project configuration.
   * If `headless` is `false`: open the Cypress application, the user will
   * be able to interact directly with the application.
   * If `headless` is `true`: Cypress will run in headless mode and will
   * provide directly the results in the console output.
   * @param cypressConfig
   * @param headless
   * @param baseUrl
   * @param isWatching
   */
  private initCypress(
    cypressConfig: string,
    headless: boolean,
    exit: boolean,
    record: boolean,
    key: string,
    parallel: boolean,
    isWatching: boolean,
    baseUrl: string,
    browser?: string
  ): Observable<BuildEvent> {
    // Cypress expects the folder where a `cypress.json` is present
    const projectFolderPath = path.dirname(cypressConfig);
    const options: any = {
      project: projectFolderPath
    };

    // If not, will use the `baseUrl` normally from `cypress.json`
    if (baseUrl || this.computedCypressBaseUrl) {
      options.config = { baseUrl: baseUrl || this.computedCypressBaseUrl };
    }

    if (browser) {
      options.browser = browser;
    }

    options.exit = exit;
    options.headed = !headless;
    options.record = record;
    options.key = key;
    options.parallel = parallel;

    return fromPromise<any>(
      !isWatching || headless ? Cypress.run(options) : Cypress.open(options)
    ).pipe(
      tap(() => (isWatching && !headless ? process.exit() : null)), // Forcing `cypress.open` to give back the terminal
      map(result => ({
        /**
         * `cypress.open` is returning `0` and is not of the same type as `cypress.run`.
         * `cypress.open` is the graphical UI, so it will be obvious to know what wasn't
         * working. Forcing the build to success when `cypress.open` is used.
         */
        success: result.hasOwnProperty(`totalFailed`)
          ? result.totalFailed === 0
          : true
      }))
    );
  }

  /**
   * @whatItDoes Compile the application using the webpack builder.
   * @param devServerTarget
   * @param isWatching
   * @private
   */
  private startDevServer(
    devServerTarget: string,
    isWatching: boolean
  ): Observable<BuildEvent> {
    const architect = this.context.architect;
    const [project, targetName, configuration] = devServerTarget.split(':');
    // Overrides dev server watch setting.
    const overrides: Partial<any> = { watch: isWatching };
    const targetSpec = {
      project,
      target: targetName,
      configuration,
      overrides: overrides
    };
    const builderConfig = architect.getBuilderConfiguration<any>(targetSpec);

    return architect.getBuilderDescription(builderConfig).pipe(
      concatMap(devServerDescription =>
        architect.validateBuilderOptions(builderConfig, devServerDescription)
      ),
      tap(builderConfig => {
        if (devServerTarget && builderConfig.options.publicHost) {
          let publicHost = builderConfig.options.publicHost;
          if (!/^\w+:\/\//.test(publicHost)) {
            publicHost = `${
              builderConfig.options.ssl ? 'https' : 'http'
            }://${publicHost}`;
          }
          const clientUrl = url.parse(publicHost);
          this.computedCypressBaseUrl = url.format(clientUrl);
        } else if (devServerTarget) {
          this.computedCypressBaseUrl = url.format({
            protocol: builderConfig.options.ssl ? 'https' : 'http',
            hostname: builderConfig.options.host,
            port: builderConfig.options.port.toString(),
            pathname: builderConfig.options.servePath || ''
          });
        }
      }),
      concatMap(builderConfig => architect.run(builderConfig, this.context))
    );
  }

  private killProcess(): void {
    return treeKill(this.tscProcess.pid, 'SIGTERM', error => {
      this.tscProcess = null;
      if (error) {
        if (Array.isArray(error) && error[0] && error[2]) {
          const errorMessage = error[2];
          this.context.logger.error(errorMessage);
        } else if (error.message) {
          this.context.logger.error(error.message);
        }
      }
    });
  }
}
