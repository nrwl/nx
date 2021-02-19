import { BuilderContext } from '@angular-devkit/architect';

export async function getProjectRoot(context: BuilderContext): Promise<string> {
  const projectMeta = await context.getProjectMetadata(context.target.project);
  if (projectMeta.root) {
    return projectMeta.root as string;
  } else {
    context.reportStatus('Error');
    const message = `${context.target.project} does not have a sourceRoot. Please define one.`;
    context.logger.error(message);
    throw new Error(message);
  }
}
