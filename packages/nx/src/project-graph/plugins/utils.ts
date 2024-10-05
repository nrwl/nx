import {
  CreateNodesContextV2,
  CreateNodesFunction,
  CreateNodesResult,
} from './public-api';
import { AggregateCreateNodesError } from '../error-types';
export async function createNodesFromFiles<T = unknown>(
  createNodes: CreateNodesFunction<T>,
  configFiles: readonly string[],
  options: T,
  context: CreateNodesContextV2
) {
  const results: Array<[file: string, value: CreateNodesResult]> = [];
  const errors: Array<[file: string, error: Error]> = [];

  await Promise.all(
    configFiles.map(async (file) => {
      try {
        const value = await createNodes(file, options, {
          ...context,
          configFiles,
        });
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
