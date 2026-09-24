import { ProjectGraph } from '../config/project-graph';
import {
  ExternalNode,
  ExternalObject,
  Project,
  Target,
  ProjectGraph as RustProjectGraph,
  transferProjectGraph,
} from './index';

/**
 * Keyed by graph identity, but weak so a replaced graph is collectable. `nx
 * release` runs the locators once per commit with the same graph, and a run's
 * hasher reuses what affected already copied.
 */
const transferred = new WeakMap<
  ProjectGraph,
  ExternalObject<RustProjectGraph>
>();

/** The graph copied into Rust, once per graph. */
export function transformProjectGraphForRust(
  graph: ProjectGraph
): ExternalObject<RustProjectGraph> {
  let ref = transferred.get(graph);
  if (!ref) {
    ref = transferProjectGraph(toRustProjectGraph(graph));
    transferred.set(graph, ref);
  }
  return ref;
}

/** The graph in Rust's shape, still a JS object. Uncached, so safe to edit. */
export function toRustProjectGraph(graph: ProjectGraph): RustProjectGraph {
  const dependencies: Record<string, string[]> = {};
  const nodes: Record<string, Project> = {};
  const externalNodes: Record<string, ExternalNode> = {};
  for (const [projectName, projectNode] of Object.entries(graph.nodes)) {
    const targets: Record<string, Target> = {};
    for (const [targetName, targetConfig] of Object.entries(
      projectNode.data.targets ?? {}
    )) {
      targets[targetName] = {
        executor: targetConfig.executor,
        inputs: targetConfig.inputs,
        outputs: targetConfig.outputs,
        options: JSON.stringify(targetConfig.options),
        configurations: JSON.stringify(targetConfig.configurations),
        parallelism: targetConfig.parallelism,
      };
    }
    nodes[projectName] = {
      root: projectNode.data.root,
      namedInputs: projectNode.data.namedInputs,
      targets,
      tags: projectNode.data.tags,
    };
    if (graph.dependencies[projectName]) {
      dependencies[projectName] = [];
      for (const dep of graph.dependencies[projectName]) {
        dependencies[projectName].push(dep.target);
      }
    }
  }
  for (const [projectName, externalNode] of Object.entries(
    graph.externalNodes ?? {}
  )) {
    externalNodes[projectName] = {
      type: externalNode.type,
      packageName: externalNode.data.packageName,
      hash: externalNode.data.hash,
      version: externalNode.data.version,
    };
    if (graph.dependencies[projectName]) {
      dependencies[projectName] = [];
      for (const dep of graph.dependencies[projectName]) {
        dependencies[projectName].push(dep.target);
      }
    }
  }

  return {
    nodes,
    externalNodes,
    dependencies,
  };
}
