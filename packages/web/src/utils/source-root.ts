import { BuilderContext } from '@angular-devkit/architect';
import { workspaces } from '@angular-devkit/core';
import { Host } from '@angular-devkit/core/src/virtual-fs/host';

export async function getSourceRoot(context: BuilderContext): Promise<string> {
  const projectMeta = await context.getProjectMetadata(context.target.project);
  if (projectMeta.sourceRoot) {
    return projectMeta.sourceRoot as string;
  } else {
    context.reportStatus('Error');
    const message = `${context.target.project} does not have a sourceRoot. Please define one.`;
    context.logger.error(message);
    throw new Error(message);
  }
}
