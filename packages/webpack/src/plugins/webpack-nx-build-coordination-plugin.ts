import { exec } from 'child_process';
import type { Compiler } from 'webpack';
import { daemonClient } from 'nx/src/daemon/client/client';
import { BatchFunctionRunner } from 'nx/src/command-line/watch';
import { output } from 'nx/src/utils/output';

export class WebpackNxBuildCoordinationPlugin {
  private currentlyRunning: 'none' | 'nx-build' | 'webpack-build' = 'none';

  constructor(private readonly buildCmd: string, skipInitialBuild?: boolean) {
    if (!skipInitialBuild) {
      this.buildChangedProjects();
    }
    this.startWatchingBuildableLibs();
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
    const unregisterFileWatcher = await createFileWatcher(
      () => this.buildChangedProjects(),
      () => {
        output.error({
          title: 'Watch connection closed',
          bodyLines: [
            'The daemon has closed the connection to this watch process.',
            'Please restart your watch command.',
          ],
        });
        process.exit(1);
      }
    );

    process.on('exit', () => {
      unregisterFileWatcher();
    });
  }

  async buildChangedProjects() {
    while (this.currentlyRunning === 'webpack-build') {
      await sleep(50);
    }
    this.currentlyRunning = 'nx-build';
    return new Promise<void>((res) => {
      try {
        const cp = exec(this.buildCmd);

        cp.stdout.pipe(process.stdout);
        cp.stderr.pipe(process.stderr);
        cp.on('exit', () => {
          res();
        });
        cp.on('error', () => {
          res();
        });
        // eslint-disable-next-line no-empty
      } catch (e) {
        res();
      } finally {
        this.currentlyRunning = 'none';
      }
    });
  }
}

function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
async function createFileWatcher(
  changeHandler: () => Promise<void>,
  onClose: () => void
) {
  const runner = new BatchFunctionRunner(changeHandler);
  return daemonClient.registerFileWatcher(
    {
      watchProjects: 'all',
    },
    (err, { changedProjects, changedFiles }) => {
      if (err === 'closed') {
        onClose();
      }
      // Queue a build
      runner.enqueue(changedProjects, changedFiles);
    }
  );
}
