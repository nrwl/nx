import { BuilderContext } from '@angular-devkit/architect';
import { workspaces } from '@angular-devkit/core';
import { Host } from '@angular-devkit/core/src/virtual-fs/host';

export async function getRoot(context: BuilderContext, host: Host<{}>) {
  const workspaceHost = workspaces.createWorkspaceHost(host);
  const { workspace } = await workspaces.readWorkspace(
    context.workspaceRoot,
    workspaceHost
  );
  if (workspace.projects.get(context.target.project).root) {
    return workspace.projects.get(context.target.project).root;
  } else {
    context.reportStatus('Error');
    const message = `${context.target.project} does not have a root. Please define one.`;
    context.logger.error(message);
    throw new Error(message);
  }
}
