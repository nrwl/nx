import type { CreateNodesContext } from 'nx/src/devkit-exports';
import { requireNx } from '../../nx';
import { join } from 'path';
const { hashWithWorkspaceContext, hashArray, hashObject } = requireNx();

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
