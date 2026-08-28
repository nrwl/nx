import {
  ExternalObject,
  HashPlanner,
  ProjectGraph as NativeProjectGraph,
  transferProjectGraph,
} from '../../native';
import { NxJsonConfiguration } from '../../config/nx-json';
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

/**
 * One planner per graph, shared with the hasher.
 *
 * Task-grained affected plans the candidate tasks to decide what is affected,
 * and the hasher then plans the surviving ones again. A planner carries
 * `subtree_memo`, `instruction_pool` and `external_deps_mapped` across
 * `getPlans` calls, so sharing the instance makes the second pass mostly memo
 * hits rather than a repeat of the first.
 */
const planners = new WeakMap<ProjectGraph, HashPlanner>();

export function getSharedPlanner(
  graph: ProjectGraph,
  nxJson: NxJsonConfiguration
): HashPlanner {
  let planner = planners.get(graph);
  if (!planner) {
    planner = new HashPlanner(nxJson as any, marshalGraph(graph));
    planners.set(graph, planner);
  }
  return planner;
}
