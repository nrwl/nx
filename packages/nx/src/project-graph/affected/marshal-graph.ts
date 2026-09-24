import {
  ExternalObject,
  ProjectGraph as NativeProjectGraph,
  transferProjectGraph,
} from '../../native';
import { transformProjectGraphForRust } from '../../native/transform-objects';
import { ProjectGraph } from '../../config/project-graph';

/**
 * Keyed by graph identity like `reverse` in ../operators, but weak so a
 * replaced graph is collectable. `nx release` runs the locators once per commit
 * with the same graph, and a run's hasher reuses what affected marshalled.
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
