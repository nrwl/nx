import {
  Builder,
  BuilderConfiguration,
  BuilderContext,
  BuilderDescription,
  BuildEvent
} from '@angular-devkit/architect';
import { Observable, of, Subscriber, noop } from 'rxjs';
import { catchError, concatMap, tap, map, take } from 'rxjs/operators';
import { ChildProcess, fork, spawn } from 'child_process';
import { copySync } from 'fs-extra';
import { fromPromise } from 'rxjs/internal-compatibility';
import { DevServerBuilderOptions } from '@angular-devkit/build-angular';
import { readFile } from '@angular-devkit/schematics/tools/file-system-utility';
import * as path from 'path';
import * as url from 'url';
const Cypress = require('cypress'); // @NOTE: Importing via ES6 messes the whole test dependencies.

export interface CypressBuilderOptions {
  baseUrl: string;
  cypressConfig: string;
  devServerTarget: string;
  headless: boolean;
  tsConfig: string;
  watch: boolean;
}

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
        "builder": "@nrwl/builders:cypress",
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

    return this.compileTypescriptFiles(options.tsConfig, options.watch).pipe(
      tap(() => this.copyCypressFixtures(options.tsConfig)),
      concatMap(
        () =>
          !options.baseUrl && options.devServerTarget
            ? this.startDevServer(options.devServerTarget, options.watch)
            : of(null)
      ),
      concatMap(() =>
        this.initCypress(
          options.cypressConfig,
          options.headless,
          options.watch,
          options.baseUrl
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
      this.tscProcess.kill();
    }
    return Observable.create((subscriber: Subscriber<BuildEvent>) => {
      try {
        let args = ['-p', tsConfigPath];
        if (isWatching) {
          args.push('--watch');
          this.tscProcess = fork(
            `${path.resolve(
              this.context.workspace.root
            )}/node_modules/.bin/tsc`,
            args,
            { stdio: [0, 1, 2, 'ipc'] }
          );
          subscriber.next({ success: true });
        } else {
          this.tscProcess = spawn(
            `${path.resolve(
              this.context.workspace.root
            )}/node_modules/.bin/tsc`,
            args,
            { stdio: [0, 1, 2] }
          );
          this.tscProcess.on('exit', code => {
            subscriber.next({ success: code === 0 });
            subscriber.complete();
          });
        }
      } catch (error) {
        if (this.tscProcess) {
          this.tscProcess.kill();
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
  private copyCypressFixtures(tsConfigPath: string) {
    const tsconfigJson = JSON.parse(readFile(tsConfigPath));
    copySync(
      `${path.dirname(tsConfigPath)}/src/fixtures`,
      `${path.resolve(
        path.dirname(tsConfigPath),
        tsconfigJson.compilerOptions.outDir
      )}/fixtures`,
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
   */
  private initCypress(
    cypressConfig: string,
    headless: boolean,
    isWatching: boolean,
    baseUrl: string
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

    options.headed = !headless;

    return fromPromise<any>(
      !isWatching ? Cypress.run(options) : Cypress.open(options)
    ).pipe(map(result => ({ success: result.failedTests === 0 })));
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
    // Override dev server watch setting.
    const overrides: Partial<DevServerBuilderOptions> = { watch: isWatching };
    const targetSpec = {
      project,
      target: targetName,
      configuration,
      overrides
    };
    const builderConfig = architect.getBuilderConfiguration<
      DevServerBuilderOptions
    >(targetSpec);

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
            port: builderConfig.options.port.toString()
          });
        }
      }),
      concatMap(builderConfig => architect.run(builderConfig, this.context))
    );
  }
}
