import { ChildProcess, fork } from 'child_process';
import { BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import { readJsonFile } from '@nrwl/workspace';
import { dirname, join } from 'path';
import { removeSync, copySync } from 'fs-extra';
import { concatMap, map, tap } from 'rxjs/operators';
import { Observable, of, Subscriber } from 'rxjs';
import * as treeKill from 'tree-kill';
import { CypressBuilderOptions, startDevServer } from './cypress.impl';

let tscProcess: ChildProcess;

export function legacyCompile(
  options: CypressBuilderOptions,
  context: BuilderContext
) {
  const tsconfigJson = readJsonFile(
    join(context.workspaceRoot, options.tsConfig)
  );

  // Cleaning the /dist folder
  removeSync(
    join(dirname(options.tsConfig), tsconfigJson.compilerOptions.outDir)
  );

  return compileTypescriptFiles(options.tsConfig, options.watch, context).pipe(
    tap(() => {
      copyCypressFixtures(options.cypressConfig, context);
      copyIntegrationFilesByRegex(
        options.cypressConfig,
        context,
        options.copyFiles
      );
    }),
    concatMap(() =>
      options.devServerTarget
        ? startDevServer(options.devServerTarget, options.watch, context)
        : of(options.baseUrl)
    )
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
      let args = ['-p', join(context.workspaceRoot, tsConfigPath)];
      const tscPath = join(
        context.workspaceRoot,
        '/node_modules/typescript/bin/tsc'
      );
      if (isWatching) {
        args.push('--watch');
        tscProcess = fork(tscPath, args, { stdio: [0, 1, 2, 'ipc'] });
        subscriber.next({ success: true });
      } else {
        tscProcess = fork(tscPath, args, { stdio: [0, 1, 2, 'ipc'] });
        tscProcess.on('exit', (code) => {
          code === 0
            ? subscriber.next({ success: true })
            : subscriber.error('Could not compile Typescript files');
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
function copyCypressFixtures(
  cypressConfigPath: string,
  context: BuilderContext
) {
  const cypressConfig = readJsonFile(
    join(context.workspaceRoot, cypressConfigPath)
  );
  // DOn't copy fixtures if cypress config does not have it set
  if (!cypressConfig.fixturesFolder) {
    return;
  }

  copySync(
    `${dirname(join(context.workspaceRoot, cypressConfigPath))}/src/fixtures`,
    join(
      dirname(join(context.workspaceRoot, cypressConfigPath)),
      cypressConfig.fixturesFolder
    ),
    { overwrite: true }
  );
}

/**
 * @whatItDoes Copy all the integration files that match the given regex into the dist folder.
 * This is done because `tsc` doesn't handle all file types, e.g. Cucumbers `feature` files.
 * @param fileExtension File extension to copy
 */
function copyIntegrationFilesByRegex(
  cypressConfigPath: string,
  context: BuilderContext,
  regex: string
) {
  const cypressConfig = readJsonFile(
    join(context.workspaceRoot, cypressConfigPath)
  );

  if (!regex || !cypressConfig.integrationFolder) {
    return;
  }

  const regExp: RegExp = new RegExp(regex);

  copySync(
    `${dirname(
      join(context.workspaceRoot, cypressConfigPath)
    )}/src/integration`,
    join(
      dirname(join(context.workspaceRoot, cypressConfigPath)),
      cypressConfig.integrationFolder
    ),
    { filter: (file) => regExp.test(file) }
  );
}

function killProcess(context: BuilderContext): void {
  return treeKill(tscProcess.pid, 'SIGTERM', (error) => {
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
