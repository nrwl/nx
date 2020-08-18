import {
  BuilderContext,
  createBuilder,
  BuilderOutput,
  scheduleTargetAndForget,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { Observable, of, noop } from 'rxjs';
import { catchError, concatMap, tap, map, take } from 'rxjs/operators';
import { fromPromise } from 'rxjs/internal-compatibility';
import { JsonObject } from '@angular-devkit/core';
import { dirname, join, relative, basename } from 'path';
import { readJsonFile } from '@nrwl/workspace';
import { legacyCompile } from './legacy';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { installedCypressVersion } from '../../utils/cypress-version';

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
  env?: Record<string, string>;
  spec?: string;
  copyFiles?: string;
  ciBuildId?: string;
  group?: string;
  ignoreTestFiles?: string;
  reporter?: string;
  reporterOptions?: string;
}

try {
  require('dotenv').config();
} catch (e) {}

export default createBuilder<CypressBuilderOptions>(cypressBuilderRunner);

/**
 * @whatItDoes This is the starting point of the builder.
 * @param options
 * @param context
 */
export function cypressBuilderRunner(
  options: CypressBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  const legacy = isLegacy(options, context);
  if (legacy) {
    showLegacyWarning(context);
  }
  options.env = options.env || {};
  if (options.tsConfig) {
    options.env.tsConfig = join(context.workspaceRoot, options.tsConfig);
  }

  checkSupportedBrowser(options, context);

  return (!legacy
    ? options.devServerTarget
      ? startDevServer(options.devServerTarget, options.watch, context).pipe(
          map((devServerBaseUrl) => options.baseUrl || devServerBaseUrl)
        )
      : of(options.baseUrl)
    : legacyCompile(options, context)
  ).pipe(
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
        options.browser,
        options.env,
        options.spec,
        options.ciBuildId,
        options.group,
        options.ignoreTestFiles,
        options.reporter,
        options.reporterOptions
      )
    ),
    options.watch ? tap(noop) : take(1),
    catchError((error) => {
      context.reportStatus(`Error: ${error.message}`);
      context.logger.error(error.message);
      return of({
        success: false,
      });
    })
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
 * @param exit
 * @param record
 * @param key
 * @param parallel
 * @param baseUrl
 * @param isWatching
 * @param browser
 * @param env
 * @param spec
 * @param ciBuildId
 * @param group
 * @param ignoreTestFiles
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
  browser?: string,
  env?: Record<string, string>,
  spec?: string,
  ciBuildId?: string,
  group?: string,
  ignoreTestFiles?: string,
  reporter?: string,
  reporterOptions?: string
): Observable<BuilderOutput> {
  // Cypress expects the folder where a `cypress.json` is present
  const projectFolderPath = dirname(cypressConfig);
  const options: any = {
    project: projectFolderPath,
    configFile: basename(cypressConfig),
  };

  // If not, will use the `baseUrl` normally from `cypress.json`
  if (baseUrl) {
    options.config = { baseUrl: baseUrl };
  }

  if (browser) {
    options.browser = browser;
  }

  if (env) {
    options.env = env;
  }
  if (spec) {
    options.spec = spec;
  }

  options.exit = exit;
  options.headed = !headless;
  options.headless = headless;
  options.record = record;
  options.key = key;
  options.parallel = parallel;
  options.ciBuildId = ciBuildId;
  options.group = group;
  options.ignoreTestFiles = ignoreTestFiles;
  options.reporter = reporter;
  options.reporterOptions = reporterOptions;

  return fromPromise<any>(
    !isWatching || headless ? Cypress.run(options) : Cypress.open(options)
  ).pipe(
    // tap(() => (isWatching && !headless ? process.exit() : null)), // Forcing `cypress.open` to give back the terminal
    map((result) => ({
      /**
       * `cypress.open` is returning `0` and is not of the same type as `cypress.run`.
       * `cypress.open` is the graphical UI, so it will be obvious to know what wasn't
       * working. Forcing the build to success when `cypress.open` is used.
       */
      success: !result.totalFailed && !result.failures,
    }))
  );
}

/**
 * @whatItDoes Compile the application using the webpack builder.
 * @param devServerTarget
 * @param isWatching
 * @param context
 * @private
 */
export function startDevServer(
  devServerTarget: string,
  isWatching: boolean,
  context: BuilderContext
): Observable<string> {
  // Overrides dev server watch setting.
  const overrides = {
    watch: isWatching,
  };
  return scheduleTargetAndForget(
    context,
    targetFromTargetString(devServerTarget),
    overrides
  ).pipe(
    map((output) => {
      if (!output.success && !isWatching) {
        throw new Error('Could not compile application files');
      }
      return output.baseUrl as string;
    })
  );
}

function isLegacy(
  options: CypressBuilderOptions,
  context: BuilderContext
): boolean {
  const tsconfigJson = readJsonFile(
    join(context.workspaceRoot, options.tsConfig)
  );
  const cypressConfigPath = join(context.workspaceRoot, options.cypressConfig);
  const cypressJson = readJsonFile(cypressConfigPath);

  if (!cypressJson.integrationFolder) {
    throw new Error(
      `"integrationFolder" is not defined in ${options.cypressConfig}`
    );
  }

  const integrationFolder = join(
    dirname(cypressConfigPath),
    cypressJson.integrationFolder
  );
  const tsOutDirPath = join(
    context.workspaceRoot,
    dirname(options.tsConfig),
    tsconfigJson.compilerOptions.outDir
  );

  return !relative(tsOutDirPath, integrationFolder).startsWith('..');
}

function showLegacyWarning(context: BuilderContext) {
  context.logger.warn(stripIndents`
  Warning:
  You are using the legacy configuration for cypress.
  Please run "ng update @nrwl/cypress --from 8.1.0 --to 8.2.0 --migrate-only".`);
}

function checkSupportedBrowser(
  { browser }: CypressBuilderOptions,
  context: BuilderContext
) {
  // Browser was not passed in as an option, cypress will use whatever default it has set and we dont need to check it
  if (!browser) {
    return;
  }

  if (installedCypressVersion() >= 4 && browser == 'canary') {
    context.logger.warn(stripIndents`
  Warning:
  You are using a browser that is not supported by cypress v4+.

  Read here for more info:
  https://docs.cypress.io/guides/references/migration-guide.html#Launching-Chrome-Canary-with-browser
  `);
    return;
  }

  const supportedV3Browsers = ['electron', 'chrome', 'canary', 'chromium'];
  if (
    installedCypressVersion() <= 3 &&
    !supportedV3Browsers.includes(browser)
  ) {
    context.logger.warn(stripIndents`
    Warning:
    You are using a browser that is not supported by cypress v3.
    `);
    return;
  }
}
