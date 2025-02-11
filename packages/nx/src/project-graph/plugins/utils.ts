import {
  CreateNodesContext,
  CreateNodesContextV2,
  CreateNodesResult,
} from './public-api';
import { AggregateCreateNodesError } from '../error-types';
export async function createNodesFromFiles<T = unknown>(
  createNodes: (
    projectConfigurationFile: string,
    options: T | undefined,
    context: CreateNodesContext,
    idx: number
  ) => CreateNodesResult | Promise<CreateNodesResult>,
  configFiles: readonly string[],
  options: T,
  context: CreateNodesContextV2
) {
  const results: Array<[file: string, value: CreateNodesResult]> = [];
  const errors: Array<[file: string, error: Error]> = [];

  await Promise.all(
    configFiles.map(async (file, idx) => {
      try {
        const value = await createNodes(
          file,
          options,
          {
            ...context,
            configFiles,
          },
          idx
        );
        if (value) {
          results.push([file, value] as const);
        }
      } catch (e) {
        errors.push([file, e] as const);
      }
    })
  );

  if (errors.length > 0) {
    throw new AggregateCreateNodesError(errors, results);
  }
  return results;
}
