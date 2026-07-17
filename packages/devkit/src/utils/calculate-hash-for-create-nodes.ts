import { join } from 'path';
import { CreateNodesContext, hashArray } from 'nx/src/devkit-exports';

import {
  hashMultiGlobWithWorkspaceContext,
  hashObject,
  hashWithWorkspaceContext,
} from 'nx/src/devkit-internals';

/**
 * @deprecated Use {@link calculateHashesForCreateNodes} instead, which batches
 * workspace-context hashing across multiple project roots in a single call.
 * This will be removed in Nx 24.
 */
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

export async function calculateHashesForCreateNodes(
  projectRoots: string[],
  options: object,
  context: CreateNodesContext,
  additionalGlobs: string[][] = []
): Promise<string[]> {
  if (projectRoots.length === 0) {
    return [];
  }
  if (
    additionalGlobs.length &&
    additionalGlobs.length !== projectRoots.length
  ) {
    throw new Error(
      `calculateHashesForCreateNodes: projectRoots.length (${projectRoots.length}) !== additionalGlobs.length (${additionalGlobs.length})`
    );
  }
  const hashes = await hashMultiGlobWithWorkspaceContext(
    context.workspaceRoot,
    projectRoots.map((projectRoot, idx) => [
      join(projectRoot, '**/*'),
      ...(additionalGlobs.length ? additionalGlobs[idx] : []),
    ])
  );
  return hashes.map((hash) => hashArray([hash, hashObject(options)]));
}
