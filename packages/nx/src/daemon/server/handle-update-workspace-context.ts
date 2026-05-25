import { scheduleProjectGraphRecomputation } from './project-graph-incremental-recomputation';
import type { HandlerResult } from './server';

export async function handleUpdateWorkspaceContext(
  createdFiles: string[],
  updatedFiles: string[],
  deletedFiles: string[]
): Promise<HandlerResult> {
  scheduleProjectGraphRecomputation(createdFiles, updatedFiles, deletedFiles);

  return {
    response: '{}',
    description: 'handleUpdateContextFiles',
  };
}
