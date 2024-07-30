import { addUpdatedAndDeletedFiles } from './project-graph-incremental-recomputation';
import type { HandlerResult } from './server';

export async function handleUpdateContextFiles(
  createdFiles: string[],
  updatedFiles: string[],
  deletedFiles: string[]
): Promise<HandlerResult> {
  addUpdatedAndDeletedFiles(createdFiles, updatedFiles, deletedFiles);

  return {
    response: '{}',
    description: 'handleUpdateContextFiles',
  };
}
