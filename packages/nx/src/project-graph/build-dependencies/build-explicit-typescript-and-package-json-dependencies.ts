import { buildExplicitTypeScriptDependencies } from './explicit-project-dependencies';
import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';
import { ProjectFileMap, ProjectGraph } from '../../config/project-graph';
import { ProjectsConfigurations } from '../../config/workspace-json-project-json';
import { NxJsonConfiguration } from 'nx/src/config/nx-json';

export function buildExplicitTypescriptAndPackageJsonDependencies(
  jsPluginConfig: {
    analyzeSourceFiles?: boolean;
    analyzePackageJson?: boolean;
  },
  nxJsonConfiguration: NxJsonConfiguration,
  projectsConfigurations: ProjectsConfigurations,
  projectGraph: ProjectGraph,
  filesToProcess: ProjectFileMap
) {
  let res = [];
  if (
    jsPluginConfig.analyzeSourceFiles === undefined ||
    jsPluginConfig.analyzeSourceFiles === true
  ) {
    res = res.concat(
      buildExplicitTypeScriptDependencies(projectGraph, filesToProcess)
    );
  }
  if (
    jsPluginConfig.analyzePackageJson === undefined ||
    jsPluginConfig.analyzePackageJson === true
  ) {
    res = res.concat(
      buildExplicitPackageJsonDependencies(
        nxJsonConfiguration,
        projectsConfigurations,
        projectGraph,
        filesToProcess
      )
    );
  }
  return res;
}
