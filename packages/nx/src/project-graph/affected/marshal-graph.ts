import {
  ExternalObject,
  ProjectGraph as NativeProjectGraph,
  transferProjectGraph,
} from '../../native';
import {
  transformProjectGraphForRust,
  transformProjectGraphForRustWithoutExternals,
} from '../../native/transform-objects';
import { ProjectGraph } from '../../config/project-graph';

/**
 * Keyed by graph identity like `reverse` in ../operators, but weak so a
 * replaced graph is collectable.
 */
function memoizedMarshal(
  transform: (graph: ProjectGraph) => NativeProjectGraph
): (graph: ProjectGraph) => ExternalObject<NativeProjectGraph> {
  const marshalled = new WeakMap<
    ProjectGraph,
    ExternalObject<NativeProjectGraph>
  >();
  return (graph) => {
    let ref = marshalled.get(graph);
    if (!ref) {
      ref = transferProjectGraph(transform(graph));
      marshalled.set(graph, ref);
    }
    return ref;
  };
}

/** The whole graph, for the planner and hasher, which read external nodes. */
export const marshalGraph = memoizedMarshal(transformProjectGraphForRust);

/**
 * Projects only, for the touched-project locators, which read no external
 * node. `nx release` runs them once per commit with the same graph, so this is
 * per-graph rather than per-call.
 */
export const marshalGraphWithoutExternals = memoizedMarshal(
  transformProjectGraphForRustWithoutExternals
);
