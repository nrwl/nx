/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuilderOutput } from '@angular-devkit/architect';
import { ForkOptions, fork } from 'child_process';
import { resolve } from 'path';
import { Observable } from 'rxjs';
const treeKill = require('tree-kill');


export function runModuleAsObservableFork(
  cwd: string,
  modulePath: string,
  exportName: string | undefined,
  // tslint:disable-next-line:no-any
  args: any[],
): Observable<BuilderOutput> {
  return new Observable(obs => {
    const workerPath: string = resolve(__dirname, './run-module-worker.js');

    const debugArgRegex = /--inspect(?:-brk|-port)?|--debug(?:-brk|-port)/;
    const execArgv = process.execArgv.filter((arg) => {
      // Remove debug args.
      // Workaround for https://github.com/nodejs/node/issues/9435
      return !debugArgRegex.test(arg);
    });
    const forkOptions: ForkOptions = {
      cwd,
      execArgv,
    } as {} as ForkOptions;

    // TODO: support passing in a logger to use as stdio streams
    // if (logger) {
    //   (forkOptions as any).stdio = [
    //     'ignore',
    //     logger.info, // make it a stream
    //     logger.error, // make it a stream
    //   ];
    // }

    const forkedProcess = fork(workerPath, undefined, forkOptions);

    // Cleanup.
    const killForkedProcess = () => {
      if (forkedProcess && forkedProcess.pid) {
        treeKill(forkedProcess.pid, 'SIGTERM');
      }
    };

    // Handle child process exit.
    const handleChildProcessExit = (code?: number) => {
      killForkedProcess();
      if (code && code !== 0) {
        obs.error();
      }
      obs.next({ success: true });
      obs.complete();
    };
    forkedProcess.once('exit', handleChildProcessExit);
    forkedProcess.once('SIGINT', handleChildProcessExit);
    forkedProcess.once('uncaughtException', handleChildProcessExit);

    // Handle parent process exit.
    const handleParentProcessExit = () => {
      killForkedProcess();
    };
    process.once('exit', handleParentProcessExit);
    process.once('SIGINT', handleParentProcessExit);
    process.once('uncaughtException', handleParentProcessExit);

    // Run module.
    forkedProcess.send({
      hash: '5d4b9a5c0a4e0f9977598437b0e85bcc',
      modulePath,
      exportName,
      args,
    });

    // Teardown logic. When unsubscribing, kill the forked process.
    return killForkedProcess;
  });
}
