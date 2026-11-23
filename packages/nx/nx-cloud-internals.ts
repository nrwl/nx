// Nx internals for the Nx Cloud client, loaded as `nx/nx-cloud-internals`; not
// a public API. The client probes these exports to tell what this nx supports,
// so keep them stable.

export {
  importUltracacheConfigurationFiles,
  importUltracacheConfigurations,
  openUltracacheConfigurations,
} from './src/ultracache/store';

// Nx Cloud reads it to pick the task-graph shape it hands this nx. Bump it when
// the shape changes in a way Cloud must handle.
//   1: `dependencies` and `continuousDependencies` edges are task ids (implied
//      when the export is absent)
//   2: edges are objects (`{ id, waitFor?, inputs? }`)
export const TASK_GRAPH_FORMAT = 2;

// Recorded reads match tracked files and the outputs of upstream tasks only,
// unless a target sets `ultracache.includeUnstableFiles`. Nx Cloud keeps other
// ignored files out of the configurations it builds for an nx that exports it.
export const ULTRACACHE_HASHES_TRACKED_READS_ONLY = true;
