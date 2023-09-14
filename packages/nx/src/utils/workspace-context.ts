import type { ConfigurationParserResult, WorkspaceContext } from '../native';
import { performance } from 'perf_hooks';

let workspaceContext: WorkspaceContext | undefined;

export function setupWorkspaceContext(workspaceRoot: string) {
  const { WorkspaceContext } =
    require('../native') as typeof import('../native');
  performance.mark('workspace-context');
  workspaceContext = new WorkspaceContext(workspaceRoot);
  performance.mark('workspace-context:end');
  performance.measure(
    'workspace context init',
    'workspace-context',
    'workspace-context:end'
  );
}

export function getNxWorkspaceFilesFromContext(
  workspaceRoot: string,
  globs: string[],
  parseConfigurations: (files: string[]) => ConfigurationParserResult
) {
  ensureContextAvailable(workspaceRoot);
  return workspaceContext.getWorkspaceFiles(globs, parseConfigurations);
}

export function globWithWorkspaceContext(
  workspaceRoot: string,
  globs: string[]
) {
  ensureContextAvailable(workspaceRoot);
  return workspaceContext.glob(globs);
}

export function getProjectConfigurationsFromContext(
  workspaceRoot: string,
  globs: string[],
  parseConfigurations: (files: string[]) => ConfigurationParserResult
) {
  ensureContextAvailable(workspaceRoot);
  return workspaceContext.getProjectConfigurations(globs, parseConfigurations);
}

export function updateFilesInContext(
  updatedFiles: string[],
  deletedFiles: string[]
) {
  return workspaceContext?.incrementalUpdate(updatedFiles, deletedFiles);
}

export function getAllFileDataInContext(workspaceRoot: string) {
  ensureContextAvailable(workspaceRoot);
  return workspaceContext.allFileData();
}

function ensureContextAvailable(workspaceRoot: string) {
  if (!workspaceContext || workspaceContext?.workspaceRoot !== workspaceRoot) {
    setupWorkspaceContext(workspaceRoot);
  }
}

export function resetWorkspaceContext() {
  workspaceContext = undefined;
}
