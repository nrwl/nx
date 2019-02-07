import {
  BuildEvent,
  Builder,
  BuilderConfiguration,
  BuilderContext
} from '@angular-devkit/architect';
import { ChildProcess, fork } from 'child_process';
import * as treeKill from 'tree-kill';

import { Observable, bindCallback, of } from 'rxjs';
import { concatMap, tap, mapTo } from 'rxjs/operators';

import {
  BuildNodeBuilderOptions,
  NodeBuildEvent
} from '../build/node-build.builder';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

try {
  require('dotenv').config();
} catch (e) {}

export const enum InspectType {
  Inspect = 'inspect',
  InspectBrk = 'inspect-brk'
}

export interface NodeExecuteBuilderOptions {
  inspect: boolean | InspectType;
  args: string[];
  buildTarget: string;
  port: number;
}

export class NodeExecuteBuilder implements Builder<NodeExecuteBuilderOptions> {
  private subProcess: ChildProcess;

  constructor(private context: BuilderContext) {}

  run(
    target: BuilderConfiguration<NodeExecuteBuilderOptions>
  ): Observable<BuildEvent> {
    const options = target.options;

    return this.startBuild(options).pipe(
      concatMap((event: NodeBuildEvent) => {
        if (event.success) {
          return this.restartProcess(event.outfile, options).pipe(mapTo(event));
        } else {
          this.context.logger.error(
            'There was an error with the build. See above.'
          );
          this.context.logger.info(`${event.outfile} was not restarted.`);
          return of(event);
        }
      })
    );
  }

  private runProcess(file: string, options: NodeExecuteBuilderOptions) {
    if (this.subProcess) {
      throw new Error('Already running');
    }
    this.subProcess = fork(file, options.args, {
      execArgv: this.getExecArgv(options)
    });
  }

  private getExecArgv(options: NodeExecuteBuilderOptions) {
    if (!options.inspect) {
      return [];
    }

    if (options.inspect === true) {
      options.inspect = InspectType.Inspect;
    }

    return [`--${options.inspect}=localhost:${options.port}`];
  }

  private restartProcess(file: string, options: NodeExecuteBuilderOptions) {
    return this.killProcess().pipe(
      tap(() => {
        this.runProcess(file, options);
      })
    );
  }

  private killProcess(): Observable<void | Error> {
    if (!this.subProcess) {
      return of(undefined);
    }

    const observableTreeKill = bindCallback(treeKill);
    return observableTreeKill(this.subProcess.pid, 'SIGTERM').pipe(
      tap(err => {
        this.subProcess = null;
        if (err) {
          if (Array.isArray(err) && err[0] && err[2]) {
            const errorMessage = err[2];
            this.context.logger.error(errorMessage);
          } else if (err.message) {
            this.context.logger.error(err.message);
          }
        }
      })
    );
  }

  private startBuild(
    options: NodeExecuteBuilderOptions
  ): Observable<NodeBuildEvent> {
    const builderConfig = this._getBuildBuilderConfig(options);

    return this.context.architect.getBuilderDescription(builderConfig).pipe(
      concatMap(buildDescription =>
        this.context.architect.validateBuilderOptions(
          builderConfig,
          buildDescription
        )
      ),
      tap(builderConfig => {
        if (builderConfig.options.optimization) {
          this.context.logger.warn(stripIndents`
            ************************************************
            This is a simple process manager for use in
            testing or debugging Node applications locally.
            DO NOT USE IT FOR PRODUCTION!
            You should look into proper means of deploying
            your node application to production.
            ************************************************`);
        }
      }),
      concatMap(
        builderConfig =>
          this.context.architect.run(builderConfig, this.context) as Observable<
            NodeBuildEvent
          >
      )
    );
  }

  private _getBuildBuilderConfig(options: NodeExecuteBuilderOptions) {
    const [project, target, configuration] = options.buildTarget.split(':');

    return this.context.architect.getBuilderConfiguration<
      BuildNodeBuilderOptions
    >({
      project,
      target,
      configuration,
      overrides: {
        watch: true
      }
    });
  }
}

export default NodeExecuteBuilder;
