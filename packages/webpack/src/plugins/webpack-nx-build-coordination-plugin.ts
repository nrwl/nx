import { watch } from 'chokidar';
import { exec } from 'child_process';
import { workspaceLayout } from '@nx/devkit';
import { joinPathFragments } from '@nx/devkit';
import ignore from 'ignore';
import { readFileSync } from 'fs';
import type { Compiler } from 'webpack';

export class WebpackNxBuildCoordinationPlugin {
  private currentlyRunning: 'none' | 'nx-build' | 'webpack-build' = 'none';
  private buildQueued = false;

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

  startWatchingBuildableLibs() {
    createFileWatcher(process.cwd(), () => {
      this.buildChangedProjects();
    });
  }

  async buildChangedProjects() {
    if (!this.buildQueued) {
      this.buildQueued = true;
      while (this.currentlyRunning === 'webpack-build') {
        await sleep(50);
      }
      this.currentlyRunning = 'nx-build';
      try {
        await new Promise((res) => {
          const cp = exec(this.buildCmd);
          cp.on('exit', (code) => res(code));
          cp.stdout.pipe(process.stdout);
          cp.stderr.pipe(process.stderr);
        });
        this.buildQueued = false;
        // eslint-disable-next-line no-empty
      } catch (e) {}
      this.currentlyRunning = 'none';
    }
  }
}

function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function getIgnoredGlobs(root: string) {
  const ig = ignore();
  try {
    ig.add(readFileSync(`${root}/.gitignore`, 'utf-8'));
  } catch {}
  try {
    ig.add(readFileSync(`${root}/.nxignore`, 'utf-8'));
  } catch {}
  return ig;
}

function createFileWatcher(root: string, changeHandler: () => void) {
  const ignoredGlobs = getIgnoredGlobs(root);
  const layout = workspaceLayout();

  const watcher = watch(
    [
      joinPathFragments(layout.appsDir, '**'),
      joinPathFragments(layout.libsDir, '**'),
    ],
    {
      cwd: root,
      ignoreInitial: true,
    }
  );
  watcher.on('all', (_event: string, path: string) => {
    if (ignoredGlobs.ignores(path)) return;
    changeHandler();
  });
  return { close: () => watcher.close() };
}
