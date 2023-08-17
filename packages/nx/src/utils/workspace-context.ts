import type { ConfigurationParserResult, WorkspaceContext } from '../native';

let workspaceContext: WorkspaceContext | undefined;

export function setupWorkspaceContext(workspaceRoot: string) {
  const { WorkspaceContext } =
    require('../native') as typeof import('../native');
  workspaceContext = new WorkspaceContext(workspaceRoot);
}

export function getNxWorkspaceFilesFromContext(
  globs: string[],
  parseConfigurations: (files: string[]) => ConfigurationParserResult
) {
  checkIfContextIsAvailable();
  return workspaceContext.getWorkspaceFiles(globs, parseConfigurations);
}

export function getProjectConfigurationFilesFromContext(globs: string[]) {
  checkIfContextIsAvailable();
  return workspaceContext.getProjectConfigurationFiles(globs);
}

export function getProjectConfigurationsFromContext(
  globs: string[],
  parseConfigurations: (files: string[]) => ConfigurationParserResult
) {
  checkIfContextIsAvailable();
  return workspaceContext.getProjectConfigurations(globs, parseConfigurations);
}

function checkIfContextIsAvailable() {
  if (!workspaceContext) {
    throw new Error(
      'Workspace context is not available. Please call setupWorkspaceContext() first.'
    );
  }
}
