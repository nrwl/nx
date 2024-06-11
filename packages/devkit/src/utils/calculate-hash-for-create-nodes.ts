import { join } from 'path';
import { CreateNodesContext, hashArray } from 'nx/src/devkit-exports';

import { hashObject, hashWithWorkspaceContext } from 'nx/src/devkit-internals';

export async function calculateHashForCreateNodes(
  projectRoot: string,
  options: object,
  context: CreateNodesContext,
  additionalGlobs: string[] = []
): Promise<string> {
  return hashArray([
    await hashWithWorkspaceContext(context.workspaceRoot, [
      join(projectRoot, '**/*'),
      ...additionalGlobs,
    ]),
    hashObject(options),
  ]);
}
