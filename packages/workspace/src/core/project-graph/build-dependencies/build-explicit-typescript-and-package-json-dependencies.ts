import { ProjectFileMap, ProjectGraph, Workspace } from '@nrwl/devkit';
import { buildExplicitTypeScriptDependencies } from './explicit-project-dependencies';
import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';

export function buildExplicitTypescriptAndPackageJsonDependencies(
  workspace: Workspace,
  projectGraph: ProjectGraph,
  filesToProcess: ProjectFileMap
) {
  return []
    .concat(
      buildExplicitTypeScriptDependencies(
        workspace,
        projectGraph,
        filesToProcess
      )
    )
    .concat(
      buildExplicitPackageJsonDependencies(
        workspace,
        projectGraph,
        filesToProcess
      )
    );
}
