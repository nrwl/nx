import { type Plugin } from 'vite';
import { BatchFunctionRunner } from 'nx/src/command-line/watch/watch';
import { exec, type ChildProcess } from 'child_process';
import {
  daemonClient,
  type UnregisterCallback,
} from 'nx/src/daemon/client/client';
import { output } from 'nx/src/utils/output';

export interface NxViteBuildCoordinationPluginOptions {
  buildCommand: string;
}
export function nxViteBuildCoordinationPlugin(
  options: NxViteBuildCoordinationPluginOptions
): Plugin {
  let activeBuildProcess: ChildProcess | undefined;
  let unregisterFileWatcher: UnregisterCallback | undefined;

  async function buildChangedProjects() {
    await new Promise<void>((res) => {
      activeBuildProcess = exec(options.buildCommand, {
        windowsHide: false,
      });
      activeBuildProcess.stdout.pipe(process.stdout);
      activeBuildProcess.stderr.pipe(process.stderr);
      activeBuildProcess.on('exit', () => {
        res();
      });
      activeBuildProcess.on('error', () => {
        res();
      });
    });
    activeBuildProcess = undefined;
  }

  function createFileWatcher() {
    const runner = new BatchFunctionRunner(() => buildChangedProjects());
    return daemonClient.registerFileWatcher(
      { watchProjects: 'all' },
      (err, { changedProjects, changedFiles }) => {
        if (err === 'reconnecting') {
          // Silent - daemon restarts automatically on lockfile changes
          return;
        } else if (err === 'reconnected') {
          // Silent - reconnection succeeded
          return;
        } else if (err === 'closed') {
          output.error({
            title: `Failed to reconnect to daemon after multiple attempts`,
          });
          process.exit(1);
        } else if (err) {
          output.error({
            title: `Watch error: ${err?.message ?? 'Unknown'}`,
          });
        }

        if (activeBuildProcess) {
          activeBuildProcess.kill(2);
          activeBuildProcess = undefined;
        }

        runner.enqueue(changedProjects, changedFiles);
      }
    );
  }

  let firstBuildStart = true;

  return {
    name: 'nx-vite-build-coordination-plugin',
    async buildStart() {
      if (firstBuildStart) {
        firstBuildStart = false;
        await buildChangedProjects();
        if (daemonClient.enabled()) {
          unregisterFileWatcher = await createFileWatcher();
          process.on('exit', () => unregisterFileWatcher());
          process.on('SIGINT', () => process.exit());
        } else {
          output.warn({
            title:
              'Nx Daemon is not enabled. Projects will not be rebuilt when files change.',
          });
        }
      }
    },
  };
}
