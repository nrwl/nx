import { buildExplicitTypeScriptDependencies } from './explicit-project-dependencies';
import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';
import { Workspace } from 'nx/src/shared/workspace';
import { ProjectFileMap, ProjectGraph } from 'nx/src/shared/project-graph';

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
