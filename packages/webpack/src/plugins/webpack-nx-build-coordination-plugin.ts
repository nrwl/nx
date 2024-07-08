import { exec } from 'child_process';
import type { Compiler } from 'webpack';
import { daemonClient, isDaemonEnabled } from 'nx/src/daemon/client/client';
import { BatchFunctionRunner } from 'nx/src/command-line/watch/watch';
import { output } from 'nx/src/utils/output';

export class WebpackNxBuildCoordinationPlugin {
  private currentlyRunning: 'none' | 'nx-build' | 'webpack-build' = 'none';
  private buildCmdProcess: ReturnType<typeof exec> | null = null;

  constructor(private readonly buildCmd: string, skipInitialBuild?: boolean) {
    if (!skipInitialBuild) {
      this.buildChangedProjects();
    }
    if (isDaemonEnabled()) {
      this.startWatchingBuildableLibs();
    } else {
      output.warn({
        title:
          'Nx Daemon is not enabled. Buildable libs will not be rebuilt on file changes.',
      });
    }
  }

  apply(compiler: Compiler) {
    compiler.hooks.beforeCompile.tapPromise(
      'IncrementalDevServerPlugin',
      async () => {
        while (this.currentlyRunning === 'nx-build') {
          await sleep(50);
        }
        this.currentlyRunning = 'webpack-build';
      }
    );
    compiler.hooks.done.tapPromise('IncrementalDevServerPlugin', async () => {
      this.currentlyRunning = 'none';
    });
  }

  async startWatchingBuildableLibs() {
    const unregisterFileWatcher = await this.createFileWatcher();

    process.on('exit', () => {
      unregisterFileWatcher();
    });
  }

  async buildChangedProjects() {
    while (this.currentlyRunning === 'webpack-build') {
      await sleep(50);
    }
    this.currentlyRunning = 'nx-build';
    try {
      return await new Promise<void>((res) => {
        this.buildCmdProcess = exec(this.buildCmd);

        this.buildCmdProcess.stdout.pipe(process.stdout);
        this.buildCmdProcess.stderr.pipe(process.stderr);
        this.buildCmdProcess.on('exit', () => {
          res();
        });
        this.buildCmdProcess.on('error', () => {
          res();
        });
      });
    } finally {
      this.currentlyRunning = 'none';
      this.buildCmdProcess = null;
    }
  }

  private createFileWatcher() {
    const runner = new BatchFunctionRunner(() => this.buildChangedProjects());
    return daemonClient.registerFileWatcher(
      {
        watchProjects: 'all',
      },
      (err, { changedProjects, changedFiles }) => {
        if (err === 'closed') {
          output.error({
            title: 'Watch connection closed',
            bodyLines: [
              'The daemon has closed the connection to this watch process.',
              'Please restart your watch command.',
            ],
          });
          process.exit(1);
        }

        if (this.buildCmdProcess) {
          this.buildCmdProcess.kill(2);
          this.buildCmdProcess = null;
        }
        // Queue a build
        runner.enqueue(changedProjects, changedFiles);
      }
    );
  }
}

function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
