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
  additionalGlobs: string[][] = []
): Promise<string[]> {
  if (
    additionalGlobs.length &&
    additionalGlobs.length !== projectRoots.length
  ) {
    throw new Error(
      'If additionalGlobs is provided, it must be the same length as projectRoots'
    );
  }
  return hashMultiGlobWithWorkspaceContext(
    context.workspaceRoot,
    projectRoots.map((projectRoot, idx) => [
      join(projectRoot, '**/*'),
      ...(additionalGlobs.length ? additionalGlobs[idx] : []),
    ])
  ).then((hashes) => {
    return hashes.map((hash) => hashArray([hash, hashObject(options)]));
  });
}
