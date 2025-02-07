import { join } from 'path';
import {
  CreateNodesContext,
  CreateNodesContextV2,
  hashArray,
} from 'nx/src/devkit-exports';

import {
  hashMultiGlobWithWorkspaceContext,
  hashObject,
  hashWithWorkspaceContext,
} from 'nx/src/devkit-internals';

export async function calculateHashForCreateNodes(
  projectRoot: string,
  options: object,
  context: CreateNodesContext | CreateNodesContextV2,
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

export async function calculateHashesForCreateNodes(
  projectRoots: string[],
  options: object,
  context: CreateNodesContext | CreateNodesContextV2,
  additionalGlobs: string[] = []
): Promise<string[]> {
  return hashMultiGlobWithWorkspaceContext(
    context.workspaceRoot,
    projectRoots.map((projectRoot) => [
      join(projectRoot, '**/*'),
      ...additionalGlobs,
    ])
  ).then((hashes) => {
    return hashes.map((hash) => hashArray([hash, hashObject(options)]));
  });
}
