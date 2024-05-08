import { join } from 'path';
import { CreateNodesContext, hashArray } from 'nx/src/devkit-exports';

import { hashObject, hashWithWorkspaceContext } from 'nx/src/devkit-internals';

export function calculateHashForCreateNodes(
  projectRoot: string,
  options: object,
  context: CreateNodesContext,
  additionalGlobs: string[] = []
): string {
  return hashArray([
    hashWithWorkspaceContext(context.workspaceRoot, [
      join(projectRoot, '**/*'),
      ...additionalGlobs,
    ]),
    hashObject(options),
  ]);
}
