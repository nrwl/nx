import {
  BuilderContext,
  createBuilder,
  BuilderOutput,
  scheduleTargetAndForget,
  targetFromTargetString
} from '@angular-devkit/architect';
import { Observable, of, Subscriber, noop } from 'rxjs';
import { catchError, concatMap, tap, map, take } from 'rxjs/operators';
import { fork, ChildProcess } from 'child_process';
import { copySync, removeSync } from 'fs-extra';
import { fromPromise } from 'rxjs/internal-compatibility';
import { JsonObject } from '@angular-devkit/core';
import * as path from 'path';
import * as treeKill from 'tree-kill';
import { readJsonFile } from '@nrwl/workspace';
const Cypress = require('cypress'); // @NOTE: Importing via ES6 messes the whole test dependencies.

export interface CypressBuilderOptions extends JsonObject {
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

export default createBuilder<CypressBuilderOptions>(run);

let tscProcess: ChildProcess;

/**
 * @whatItDoes This is the starting point of the builder.
 * @param builderConfig
 */
function run(
  options: CypressBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  // TODO: consider comments
  const tsconfigJson = readJsonFile(
    path.join(context.workspaceRoot, options.tsConfig)
  );

  // Cleaning the /dist folder
  removeSync(
    path.join(
      path.dirname(options.tsConfig),
      tsconfigJson.compilerOptions.outDir
    )
  );

  return compileTypescriptFiles(options.tsConfig, options.watch, context).pipe(
    tap(() => copyCypressFixtures(options.cypressConfig, context)),
    concatMap(() =>
      options.devServerTarget
        ? startDevServer(options.devServerTarget, options.watch, context).pipe(
            map(output => output.baseUrl)
          )
        : of(options.baseUrl)
    ),
    concatMap((baseUrl: string) =>
      initCypress(
        options.cypressConfig,
        options.headless,
        options.exit,
        options.record,
        options.key,
        options.parallel,
        options.watch,
        baseUrl,
        options.browser
      )
    ),
    options.watch ? tap(noop) : take(1),
    catchError(error => {
      context.reportStatus(`Error: ${error.message}`);
      context.logger.error(error.message);
      return of({
        success: false
      });
    })
  );
}

/**
 * @whatItDoes Compile typescript spec files to be able to run Cypress.
 * The compilation is done via executing the `tsc` command line/
 * @param tsConfigPath
 * @param isWatching
 */
function compileTypescriptFiles(
  tsConfigPath: string,
  isWatching: boolean,
  context: BuilderContext
): Observable<BuilderOutput> {
  if (tscProcess) {
    killProcess(context);
  }
  return Observable.create((subscriber: Subscriber<BuilderOutput>) => {
    try {
      let args = ['-p', path.join(context.workspaceRoot, tsConfigPath)];
      const tscPath = path.join(
        context.workspaceRoot,
        '/node_modules/.bin/tsc'
      );
      if (isWatching) {
        args.push('--watch');
        tscProcess = fork(tscPath, args, { stdio: [0, 1, 2, 'ipc'] });
        subscriber.next({ success: true });
      } else {
        tscProcess = fork(tscPath, args, { stdio: [0, 1, 2, 'ipc'] });
        tscProcess.on('exit', code => {
          subscriber.next({ success: code === 0 });
          subscriber.complete();
        });
      }
    } catch (error) {
      if (tscProcess) {
        killProcess(context);
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
function copyCypressFixtures(
  cypressConfigPath: string,
  context: BuilderContext
) {
  const cypressConfig = readJsonFile(
    path.join(context.workspaceRoot, cypressConfigPath)
  );
  // DOn't copy fixtures if cypress config does not have it set
  if (!cypressConfig.fixturesFolder) {
    return;
  }

  copySync(
    `${path.dirname(
      path.join(context.workspaceRoot, cypressConfigPath)
    )}/src/fixtures`,
    path.join(
      path.dirname(path.join(context.workspaceRoot, cypressConfigPath)),
      cypressConfig.fixturesFolder
    ),
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
function initCypress(
  cypressConfig: string,
  headless: boolean,
  exit: boolean,
  record: boolean,
  key: string,
  parallel: boolean,
  isWatching: boolean,
  baseUrl: string,
  browser?: string
): Observable<BuilderOutput> {
  // Cypress expects the folder where a `cypress.json` is present
  const projectFolderPath = path.dirname(cypressConfig);
  const options: any = {
    project: projectFolderPath
  };

  // If not, will use the `baseUrl` normally from `cypress.json`
  if (baseUrl) {
    options.config = { baseUrl: baseUrl };
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
    // tap(() => (isWatching && !headless ? process.exit() : null)), // Forcing `cypress.open` to give back the terminal
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
function startDevServer(
  devServerTarget: string,
  isWatching: boolean,
  context: BuilderContext
): Observable<BuilderOutput> {
  // Overrides dev server watch setting.
  const overrides = {
    watch: isWatching
  };
  return scheduleTargetAndForget(
    context,
    targetFromTargetString(devServerTarget),
    overrides
  );
}

function killProcess(context: BuilderContext): void {
  return treeKill(tscProcess.pid, 'SIGTERM', error => {
    tscProcess = null;
    if (error) {
      if (Array.isArray(error) && error[0] && error[2]) {
        const errorMessage = error[2];
        context.logger.error(errorMessage);
      } else if (error.message) {
        context.logger.error(error.message);
      }
    }
  });
}
