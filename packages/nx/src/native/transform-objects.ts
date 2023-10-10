import { ProjectGraph } from '../config/project-graph';
import {
  ExternalNode,
  Project,
  Target,
  ProjectGraph as RustProjectGraph,
  NxJson,
} from './index';
import { TaskGraph } from '../config/task-graph';
import { NxJsonConfiguration } from '../config/nx-json';

export function transformProjectGraphForRust(
  graph: ProjectGraph
): RustProjectGraph {
  const dependencies: Record<string, string[]> = {};
  const nodes: Record<string, Project> = {};
  const externalNodes: Record<string, ExternalNode> = {};
  for (const [projectName, projectNode] of Object.entries(graph.nodes)) {
    const targets: Record<string, Target> = {};
    for (const [targetName, targetConfig] of Object.entries(
      projectNode.data.targets
    )) {
      targets[targetName] = {
        executor: targetConfig.executor,
        inputs: targetConfig.inputs,
        outputs: targetConfig.outputs,
        configurations: targetConfig.configurations
          ? `${JSON.stringify(targetConfig.configurations)}`
          : undefined,
        options: targetConfig.options
          ? `${JSON.stringify(targetConfig.options)}`
          : undefined,
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
    graph.externalNodes
  )) {
    externalNodes[projectName] = {
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

export function transformTaskGraphForRust(taskGraph: TaskGraph) {
  for (const key of Object.keys(taskGraph.tasks)) {
    const task = taskGraph.tasks[key];
    if (task.overrides) {
      task.overrides = JSON.stringify(task.overrides);
    }
  }
  return taskGraph;
}

export function transformNxJsonForRust(nxJson: NxJsonConfiguration): NxJson {
  for (const key of Object.keys(nxJson.targetDefaults ?? {})) {
    const targetDefault = nxJson.targetDefaults[key];
    if (targetDefault.options) {
      targetDefault.options = JSON.stringify(targetDefault.options);
    }
  }
  return nxJson as unknown as NxJson;
}
