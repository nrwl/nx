import { BuilderContext } from '@angular-devkit/architect';
import { normalize, workspaces } from '@angular-devkit/core';
import { NxScopedHost } from '@nrwl/devkit/ngcli-adapter';

export async function getRoot(context: BuilderContext) {
  const workspaceHost = workspaces.createWorkspaceHost(
    new NxScopedHost(normalize(context.workspaceRoot))
  );
  const { workspace } = await workspaces.readWorkspace('', workspaceHost);
  if (workspace.projects.get(context.target.project).root) {
    return workspace.projects.get(context.target.project).root;
  } else {
    context.reportStatus('Error');
    const message = `${context.target.project} does not have a root. Please define one.`;
    context.logger.error(message);
    throw new Error(message);
  }
}
