import {
  ExternalObject,
  ProjectGraph as NativeProjectGraph,
  transferProjectGraph,
} from '../../native';
import { transformProjectGraphForRust } from '../../native/transform-objects';
import { ProjectGraph } from '../../config/project-graph';

/**
 * `nx release` calls filterAffected once per commit with the same graph, so the
 * marshal has to be per-graph rather than per-call. Keyed by identity like
 * `reverse` in ../operators, but weak so a replaced graph is collectable.
 */
const marshalledGraphs = new WeakMap<
  ProjectGraph,
  ExternalObject<NativeProjectGraph>
>();

export function marshalGraph(
  graph: ProjectGraph
): ExternalObject<NativeProjectGraph> {
  let marshalled = marshalledGraphs.get(graph);
  if (!marshalled) {
    marshalled = transferProjectGraph(transformProjectGraphForRust(graph));
    marshalledGraphs.set(graph, marshalled);
  }
  return marshalled;
}
