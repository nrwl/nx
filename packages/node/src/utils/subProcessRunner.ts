import { ChildProcess, fork } from 'child_process';
import { PromiseQueue } from './promise-queue';
import { NodeBuildEvent } from '../executors/build/build.impl';
import { NodeExecuteBuilderOptions } from '../utils/types';
import { InspectType } from '@nrwl/node/src/executors/execute/execute.impl';
import { promisify } from "util";
import * as treeKill from 'tree-kill';
import { logger } from '@nrwl/tao/src/shared/logger';

export class SubProcessRunner {
  private subProcess: ChildProcess|null = null;
  private queue = new PromiseQueue();

  constructor(private options: NodeExecuteBuilderOptions ) {}

  async handleBuildEvent(event: NodeBuildEvent){
    if(this.subProcess){
      await this.kill();
    }

    this.subProcess = fork(event.outfile, this.options.args, {
      execArgv: this.getExecArgv(),
    });

    this.subProcess.on('exit', (exitCode) => {
      this.queue.enqueue({exitCode})
    });
  }

  async kill(){
    if (!this.subProcess) {
      return;
    }

    const promisifiedTreeKill: (pid: number, signal: string) => Promise<void> =
      promisify(treeKill);

    try {
      await promisifiedTreeKill(this.subProcess.pid, 'SIGTERM');
    } catch (err) {
      if (Array.isArray(err) && err[0] && err[2]) {
        const errorMessage = err[2];
        logger.error(errorMessage);
      } else if (err.message) {
        logger.error(err.message);
      }
    } finally {
      this.subProcess = null;
    }
  }

  async next(){
    if(this.isComplete()) return {done: true, value: undefined};

    return {
      done: false,
      value: await this.queue.dequeue()
    }
  }

  [Symbol.asyncIterator](){ return this; }

  private getExecArgv(){
    const args = ['-r', 'source-map-support/register', ...this.options.runtimeArgs];

    if (this.options.inspect === true) {
      this.options.inspect = InspectType.Inspect;
    }

    if (this.options.inspect) {
      args.push(`--${this.options.inspect}=${this.options.host}:${this.options.port}`);
    }

    return args;
  }

  private isComplete(){ return Boolean(this.subProcess) && this.subProcess.exitCode != null; }
}
