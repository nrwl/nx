import { parentPort } from 'worker_threads';
import { buildExplicitTypescriptAndPackageJsonDependencies } from './build-explicit-typescript-and-package-json-dependencies';
import { NxJsonConfiguration } from '../../../../config/nx-json';
import { ProjectsConfigurations } from '../../../../config/workspace-json-project-json';
import { ProjectGraph } from '../../../../config/project-graph';

let nxJsonConfiguration: NxJsonConfiguration | null;
let projectsConfigurations: ProjectsConfigurations | null;
let projectGraph: ProjectGraph | null;
let jsPluginConfig: {
  analyzeSourceFiles?: boolean;
  analyzePackageJson?: boolean;
} | null;

parentPort.on('message', (message) => {
  if (message.projectsConfigurations) {
    nxJsonConfiguration = message.nxJsonConfiguration;
    projectsConfigurations = message.projectsConfigurations;
    projectGraph = message.projectGraph;
    jsPluginConfig = message.jsPluginConfig;
  } else {
    const res = buildExplicitTypescriptAndPackageJsonDependencies(
      jsPluginConfig,
      nxJsonConfiguration,
      projectsConfigurations,
      projectGraph,
      message.filesToProcess
    );
    parentPort.postMessage(res);
  }
});
