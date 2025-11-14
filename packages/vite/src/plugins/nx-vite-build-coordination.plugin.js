'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.nxViteBuildCoordinationPlugin = nxViteBuildCoordinationPlugin;
const watch_1 = require('nx/src/command-line/watch/watch');
const child_process_1 = require('child_process');
const client_1 = require('nx/src/daemon/client/client');
const output_1 = require('nx/src/utils/output');
function nxViteBuildCoordinationPlugin(options) {
  let activeBuildProcess;
  let unregisterFileWatcher;
  async function buildChangedProjects() {
    await new Promise((res) => {
      activeBuildProcess = (0, child_process_1.exec)(options.buildCommand, {
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
    const runner = new watch_1.BatchFunctionRunner(() =>
      buildChangedProjects()
    );
    return client_1.daemonClient.registerFileWatcher(
      { watchProjects: 'all' },
      (err, { changedProjects, changedFiles }) => {
        if (err === 'closed') {
          output_1.output.error({
            title: 'Watch connection closed',
            bodyLines: [
              'The daemon had closed the connection to this watch process.',
              'Please restart your watch command.',
            ],
          });
          process.exit(1);
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
        if (client_1.daemonClient.enabled()) {
          unregisterFileWatcher = await createFileWatcher();
          process.on('exit', () => unregisterFileWatcher());
          process.on('SIGINT', () => process.exit());
        } else {
          output_1.output.warn({
            title:
              'Nx Daemon is not enabled. Projects will not be rebuilt when files change.',
          });
        }
      }
    },
  };
}
