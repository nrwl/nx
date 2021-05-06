import { WorkspaceDefinition } from '@angular-devkit/core/src/workspace';
import { SchematicsException } from '@angular-devkit/schematics';

export function validatePlugin(
  workspace: WorkspaceDefinition,
  pluginName: string
) {
  const project = workspace.projects.get(pluginName);
  if (!project) {
    throw new SchematicsException(
      `Project name "${pluginName}" doesn't not exist.`
    );
  }
}
