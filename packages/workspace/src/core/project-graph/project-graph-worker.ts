import { parentPort } from 'worker_threads';
import { ProjectGraph, Workspace } from '@nrwl/devkit';
import { buildExplicitTypescriptAndPackageJsonDependencies } from './build-dependencies/build-explicit-typescript-and-package-json-dependencies';

let workspace: Workspace | null;
let projectGraph: ProjectGraph | null;
let jsPluginConfig: {
  analyzeSourceFiles?: boolean;
  analyzePackageJson?: boolean;
} | null;

parentPort.on('message', (message) => {
  if (message.workspace) {
    workspace = message.workspace;
    projectGraph = message.projectGraph;
    jsPluginConfig = message.jsPluginConfig;
  } else {
    const res = buildExplicitTypescriptAndPackageJsonDependencies(
      jsPluginConfig,
      workspace,
      projectGraph,
      message.filesToProcess
    );
    parentPort.postMessage(res);
  }
});
