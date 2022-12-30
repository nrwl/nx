import { buildExplicitTypeScriptDependencies } from './explicit-project-dependencies';
import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';
import { ProjectFileMap, ProjectGraph } from '../../config/project-graph';
import { Workspace } from '../../config/workspace-json-project-json';

export function buildExplicitTypescriptAndPackageJsonDependencies(
  jsPluginConfig: {
    analyzeSourceFiles?: boolean;
    analyzePackageJson?: boolean;
  },
  workspace: Workspace,
  projectGraph: ProjectGraph,
  filesToProcess: ProjectFileMap
) {
  let res = [];
  if (
    jsPluginConfig.analyzeSourceFiles === undefined ||
    jsPluginConfig.analyzeSourceFiles === true
  ) {
    res = res.concat(
      buildExplicitTypeScriptDependencies(
        workspace,
        projectGraph,
        filesToProcess
      )
    );
  }
  if (
    jsPluginConfig.analyzePackageJson === undefined ||
    jsPluginConfig.analyzePackageJson === true
  ) {
    res = res.concat(
      buildExplicitPackageJsonDependencies(
        workspace,
        projectGraph,
        filesToProcess
      )
    );
  }
  return res;
}
