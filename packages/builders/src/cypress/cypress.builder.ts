import {
  Builder,
  BuilderConfiguration,
  BuilderContext,
  BuilderDescription,
  BuildEvent
} from '@angular-devkit/architect';
import { Observable, of } from 'rxjs';
import { catchError, concatMap, mapTo, tap } from 'rxjs/operators';
import { spawn } from 'child_process';
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

  constructor(public context: BuilderContext) {}

  /**
   * @whatItDoes This is the starting point of the builder.
   * @param builderConfig
   */
  run(
    builderConfig: BuilderConfiguration<CypressBuilderOptions>
  ): Observable<BuildEvent> {
    const options = builderConfig.options;

    return this.compileTypescriptFiles(options.tsConfig).pipe(
      concatMap(() => this.copyCypressFixtures(options.tsConfig)),
      concatMap(
        () =>
          !options.baseUrl && options.devServerTarget
            ? this.startDevServer(options.devServerTarget)
            : of(null)
      ),
      concatMap(() =>
        this.initCypress(
          options.cypressConfig,
          options.headless,
          options.baseUrl
        )
      ),
      catchError(error => {
        throw new Error(error);
      })
    );
  }

  /**
   * @whatItDoes Compile typescript spec files to be able to run Cypress.
   * The compilation is done via executing the `tsc` command line/
   * @param tsConfigPath
   */
  private compileTypescriptFiles(tsConfigPath: string): Observable<BuildEvent> {
    return Observable.create(subscriber => {
      try {
        const output = spawn(
          `${path.resolve(this.context.workspace.root)}/node_modules/.bin/tsc`,
          ['-p', tsConfigPath],
          { stdio: [0, 1, 2] }
        );
        output.on('exit', code => subscriber.next({ success: code === 0 }));
      } catch (error) {
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
    return Observable.create(subscriber => {
      try {
        copySync(
          `${path.dirname(tsConfigPath)}/src/fixtures`,
          `${path.resolve(
            path.dirname(tsConfigPath),
            tsconfigJson.compilerOptions.outDir
          )}/fixtures`,
          { overwrite: true }
        );
        subscriber.next({ success: true });
      } catch (error) {
        subscriber.error(
          new Error(`Could not copy Fixtures files: \n ${error}`)
        );
      }
    });
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
    baseUrl: string
  ): Observable<BuildEvent> {
    // Cypress expects the folder where a `cypress.json` is present
    const projectFolderPath = path.dirname(cypressConfig);
    const options = {
      project: projectFolderPath
    };

    // If not, will use the `baseUrl` normally from `cypress.json`
    if (baseUrl || this.computedCypressBaseUrl) {
      options['config'] = { baseUrl: baseUrl || this.computedCypressBaseUrl };
    }

    return fromPromise(
      headless ? Cypress.run(options) : Cypress.open(options)
    ).pipe(tap(() => process.exit()), mapTo({ success: true }));
  }

  /**
   * @whatItDoes Compile the application using the webpack builder.
   * @param devServerTarget
   * @private
   */
  private startDevServer(devServerTarget: string): Observable<BuildEvent> {
    const architect = this.context.architect;
    const [project, targetName, configuration] = devServerTarget.split(':');
    // Override dev server watch setting.
    const overrides: Partial<DevServerBuilderOptions> = { watch: false };
    const targetSpec = {
      project,
      target: targetName,
      configuration,
      overrides
    };
    const builderConfig = architect.getBuilderConfiguration<
      DevServerBuilderOptions
    >(targetSpec);
    let devServerDescription: BuilderDescription;
    let baseUrl: string;

    return architect.getBuilderDescription(builderConfig).pipe(
      tap(description => (devServerDescription = description)),
      concatMap(devServerDescription =>
        architect.validateBuilderOptions(builderConfig, devServerDescription)
      ),
      concatMap(() => {
        if (devServerTarget && builderConfig.options.publicHost) {
          let publicHost = builderConfig.options.publicHost;
          if (!/^\w+:\/\//.test(publicHost)) {
            publicHost = `${
              builderConfig.options.ssl ? 'https' : 'http'
            }://${publicHost}`;
          }
          const clientUrl = url.parse(publicHost);
          baseUrl = url.format(clientUrl);
        } else if (devServerTarget) {
          baseUrl = url.format({
            protocol: builderConfig.options.ssl ? 'https' : 'http',
            hostname: builderConfig.options.host,
            port: builderConfig.options.port.toString()
          });
        }

        // Save the computed baseUrl back so that Cypress can use it.
        this.computedCypressBaseUrl = baseUrl;

        return of(
          this.context.architect.getBuilder(devServerDescription, this.context)
        );
      }),
      concatMap(builder => builder.run(builderConfig))
    );
  }
}
