import { ProjectGraph } from '../config/project-graph';
import {
  ExternalNode,
  Project,
  Target,
  ProjectGraph as RustProjectGraph,
} from './index';

function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

export function transformProjectGraphForRust(
  graph: ProjectGraph
): RustProjectGraph {
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
        inputs: sortObjectKeys(targetConfig.inputs) as Target['inputs'],
        outputs: sortObjectKeys(targetConfig.outputs) as Target['outputs'],
        options: JSON.stringify(sortObjectKeys(targetConfig.options)),
        configurations: JSON.stringify(sortObjectKeys(targetConfig.configurations)),
        parallelism: targetConfig.parallelism,
      };
    }
    nodes[projectName] = {
      root: projectNode.data.root,
      namedInputs: sortObjectKeys(
        projectNode.data.namedInputs
      ) as Project['namedInputs'],
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
