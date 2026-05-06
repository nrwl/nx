import { CreateNodesContextV2, CreateNodesResult } from './public-api';
import { AggregateCreateNodesError } from '../error-types';
export async function createNodesFromFiles<T = unknown>(
  createNodes: (
    projectConfigurationFile: string,
    options: T | undefined,
    context: CreateNodesContextV2 & { configFiles: readonly string[] },
    idx: number
  ) => CreateNodesResult | Promise<CreateNodesResult>,
  configFiles: readonly string[],
  options: T,
  context: CreateNodesContextV2
) {
  // Settle each file in parallel but capture per-input outcomes so the
  // returned arrays preserve `configFiles` order. Pushing into shared
  // arrays from inside `Promise.all` would order results by resolution
  // time, which makes downstream merging into the project graph
  // non-deterministic when multiple files contribute to the same root.
  type Settled =
    | { kind: 'value'; file: string; value: CreateNodesResult }
    | { kind: 'empty' }
    | { kind: 'error'; file: string; error: Error };

  const settled: Settled[] = await Promise.all(
    configFiles.map(async (file, idx): Promise<Settled> => {
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
        return value ? { kind: 'value', file, value } : { kind: 'empty' };
      } catch (e) {
        return { kind: 'error', file, error: e };
      }
    })
  );

  const results: Array<[file: string, value: CreateNodesResult]> = [];
  const errors: Array<[file: string, error: Error]> = [];
  for (const entry of settled) {
    if (entry.kind === 'value') {
      results.push([entry.file, entry.value] as const);
    } else if (entry.kind === 'error') {
      errors.push([entry.file, entry.error] as const);
    }
  }

  if (errors.length > 0) {
    throw new AggregateCreateNodesError(errors, results);
  }
  return results;
}
