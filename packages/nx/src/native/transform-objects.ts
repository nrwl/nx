import { ProjectGraph } from '../config/project-graph';
import type { ProjectConfiguration } from '../config/workspace-json-project-json';
import {
  createLocalPluginLookup,
  findNxProjectForImportPath,
  LocalPluginLookup,
} from '../project-graph/plugins/local-plugin-project';
import { workspaceRoot } from '../utils/workspace-root';
import {
  ExternalNode,
  ExternalObject,
  Project,
  Target,
  ProjectGraph as RustProjectGraph,
  transferProjectGraph,
} from './index';

/**
 * Keyed by graph identity, but weak so a replaced graph is collectable. A run's
 * hasher reuses what affected's planner already copied.
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

/** Per graph like `transferred`: `nx release` runs the locators once per commit. */
const transferredForLocators = new WeakMap<
  ProjectGraph,
  ExternalObject<RustProjectGraph>
>();

/**
 * Only what the touched-project locators read: project roots, named inputs and
 * target inputs. Copying target options and every edge costs several times
 * what the locators themselves do on a large workspace.
 */
export function transformProjectGraphForLocators(
  graph: ProjectGraph
): ExternalObject<RustProjectGraph> {
  let ref = transferredForLocators.get(graph);
  if (!ref) {
    const nodes: Record<string, Project> = {};
    for (const [name, node] of Object.entries(graph.nodes)) {
      const targets: Record<string, Target> = {};
      for (const [target, config] of Object.entries(node.data.targets ?? {})) {
        targets[target] = { inputs: config.inputs };
      }
      nodes[name] = {
        root: node.data.root,
        namedInputs: node.data.namedInputs,
        targets,
      };
    }
    ref = transferProjectGraph({ nodes, externalNodes: {}, dependencies: {} });
    transferredForLocators.set(graph, ref);
  }
  return ref;
}

/** The graph in Rust's shape, still a JS object. Uncached, so safe to edit. */
export function toRustProjectGraph(
  graph: ProjectGraph,
  root = workspaceRoot
): RustProjectGraph {
  const dependencies: Record<string, string[]> = {};
  const nodes: Record<string, Project> = {};
  const externalNodes: Record<string, ExternalNode> = {};
  const findExecutorProject = createExecutorProjectFinder(graph, root);
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
        executorProject: findExecutorProject(targetConfig.executor),
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

/**
 * Finds the project an `@nx/*` executor loads from when its package is not
 * installed, using the executor loader's local plugin rules, then falling back
 * to a project whose package name or project name matches.
 */
function createExecutorProjectFinder(graph: ProjectGraph, root: string) {
  const found = new Map<string, string | undefined>();
  let installed: Set<string>;
  let projects: Record<string, ProjectConfiguration>;
  let lookup: LocalPluginLookup;

  return (executor: string | undefined): string | undefined => {
    if (!executor?.startsWith('@nx/') && !executor?.startsWith('@nrwl/')) {
      return undefined;
    }
    const packageName = executor.split(':')[0];
    if (found.has(packageName)) {
      return found.get(packageName);
    }

    installed ??= new Set(
      Object.entries(graph.externalNodes ?? {}).flatMap(([name, node]) => [
        name,
        node.data.packageName,
      ])
    );
    let project: string | undefined;
    if (!installed.has(packageName) && !installed.has(`npm:${packageName}`)) {
      projects ??= Object.fromEntries(
        Object.values(graph.nodes).map((node) => [
          node.data.root,
          { ...node.data, name: node.name },
        ])
      );
      lookup ??= createLocalPluginLookup(projects, root);
      project =
        findNxProjectForImportPath(packageName, projects, lookup, root)
          ?.projectConfig.name ??
        Object.values(graph.nodes).find(
          (node) => node.data.metadata?.js?.packageName === packageName
        )?.name ??
        graph.nodes[packageName]?.name;
    }
    found.set(packageName, project);
    return project;
  };
}
