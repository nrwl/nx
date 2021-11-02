import { parentPort } from 'worker_threads';
import { ProjectGraph, Workspace } from '@nrwl/devkit';
import { buildExplicitTypescriptAndPackageJsonDependencies } from './build-dependencies/build-explicit-typescript-and-package-json-dependencies';

let workspace: Workspace | null;
let projectGraph: ProjectGraph | null;

parentPort.on('message', (message) => {
  if (message.workspace) {
    workspace = message.workspace;
    projectGraph = message.projectGraph;
  } else {
    const res = buildExplicitTypescriptAndPackageJsonDependencies(
      workspace,
      projectGraph,
      message.filesToProcess
    );
    parentPort.postMessage(res);
  }
});
