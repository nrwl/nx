import {
  DependencyType,
  fileDataDepTarget,
  fileDataDepType,
  type FileData,
  type ProjectFileMap,
  type ProjectGraph,
  type ProjectGraphProjectNode,
} from '../../config/project-graph';
import { findMatchingProjects } from '../../utils/find-matching-projects';

interface Reach {
  graph: ProjectGraph;
  matrix: Record<string, Record<string, boolean>>;
  adjList: Record<string, Array<string>>;
}

let reach: Reach | null = null;

function getReach(graph: ProjectGraph): Reach {
  if (reach?.graph !== graph) {
    reach = { graph, ...buildMatrix(graph) };
  }
  return reach;
}

function buildMatrix(graph: ProjectGraph) {
  const nodes = Object.keys(graph.nodes);
  const nodesLength = nodes.length;
  const adjList: Record<string, string[]> = {};
  const matrix: Record<string, Record<string, boolean>> = {};

  // create matrix value set
  for (let i = 0; i < nodesLength; i++) {
    const v = nodes[i];
    adjList[v] = [];
    // meeroslav: turns out this is 10x faster than spreading the pre-generated initMatrixValues
    matrix[v] = {};
  }

  const projectsWithDependencies = Object.keys(graph.dependencies);
  for (let i = 0; i < projectsWithDependencies.length; i++) {
    const dependencies = graph.dependencies[projectsWithDependencies[i]];
    for (let j = 0; j < dependencies.length; j++) {
      const dependency = dependencies[j];
      if (graph.nodes[dependency.target]) {
        adjList[dependency.source].push(dependency.target);
      }
    }
  }

  const traverse = (s: string, v: string) => {
    matrix[s][v] = true;

    const adjListLength = adjList[v].length;
    for (let i = 0; i < adjListLength; i++) {
      const adj = adjList[v][i];
      if (!matrix[s][adj]) {
        traverse(s, adj);
      }
    }
  };

  for (let i = 0; i < nodesLength; i++) {
    const v = nodes[i];
    traverse(v, v);
  }

  return {
    matrix,
    adjList,
  };
}

export function getPath(
  graph: ProjectGraph,
  sourceProjectName: string,
  targetProjectName: string
): Array<ProjectGraphProjectNode> {
  if (sourceProjectName === targetProjectName) return [];

  const { matrix, adjList } = getReach(graph);

  let path: string[] = [];
  const queue: Array<[string, string[]]> = [[sourceProjectName, path]];
  const visited: string[] = [sourceProjectName];

  for (let entry = queue.pop(); entry !== undefined; entry = queue.pop()) {
    const [current, p] = entry;
    path = [...p, current];

    if (current === targetProjectName) break;

    if (!adjList[current]) break;

    adjList[current]
      .filter((adj) => visited.indexOf(adj) === -1)
      .filter((adj) => matrix[adj][targetProjectName])
      .forEach((adj) => {
        visited.push(adj);
        queue.push([adj, [...path]]);
      });
  }

  if (path.length > 1) {
    return path.map((n) => graph.nodes[n] as ProjectGraphProjectNode);
  } else {
    return [];
  }
}

export function pathExists(
  graph: ProjectGraph,
  sourceProjectName: string,
  targetProjectName: string
): boolean {
  if (sourceProjectName === targetProjectName) return true;

  return !!getReach(graph).matrix[sourceProjectName][targetProjectName];
}

export function checkCircularPath(
  graph: ProjectGraph,
  sourceProject: ProjectGraphProjectNode,
  targetProject: ProjectGraphProjectNode
): ProjectGraphProjectNode[] {
  if (!graph.nodes[targetProject.name]) return [];

  return getPath(graph, targetProject.name, sourceProject.name);
}

export function circularPathHasPair(
  circularPath: ProjectGraphProjectNode[],
  ignored: Map<string, Set<string>>
): boolean {
  if (circularPath.length < 2) return false;

  for (let i = 0; i < circularPath.length - 1; i++) {
    const dependencyIsIgnored = ignored
      .get(circularPath[i].name)
      ?.has(circularPath[i + 1].name);

    if (dependencyIsIgnored) {
      return true;
    }
  }

  return false;
}

export function findFilesInCircularPath(
  projectFileMap: ProjectFileMap,
  circularPath: ProjectGraphProjectNode[]
): Array<string[]> {
  const filePathChain = [];

  for (let i = 0; i < circularPath.length - 1; i++) {
    const next = circularPath[i + 1].name;
    const files = projectFileMap[circularPath[i].name] || [];
    filePathChain.push(
      files
        .filter(
          (file) =>
            file.deps && file.deps.find((d) => fileDataDepTarget(d) === next)
        )
        .map((file) => file.file)
    );
  }

  return filePathChain;
}

export function findFilesWithDynamicImports(
  projectFileMap: ProjectFileMap,
  sourceProjectName: string,
  targetProjectName: string
): FileData[] {
  const files: FileData[] = [];
  projectFileMap[sourceProjectName].forEach((file) => {
    if (!file.deps) return;
    if (
      file.deps.some(
        (d) =>
          fileDataDepTarget(d) === targetProjectName &&
          fileDataDepType(d) === DependencyType.dynamic
      )
    ) {
      files.push(file);
    }
  });

  return files;
}

export function expandIgnoredCircularDependencies(
  ignoredCircularDependencies: Array<[string, string]>,
  projectGraph: ProjectGraph
) {
  const allowed = new Map<string, Set<string>>();

  for (const [a, b] of ignoredCircularDependencies) {
    const setA = new Set(findMatchingProjects([a], projectGraph.nodes));
    const setB = new Set(findMatchingProjects([b], projectGraph.nodes));

    for (const projectA of setA) {
      let currentSetA = allowed.get(projectA);
      if (!currentSetA) {
        currentSetA = new Set<string>();
        allowed.set(projectA, currentSetA);
      }

      for (const projectB of setB) {
        currentSetA.add(projectB);
      }
    }

    for (const projectB of setB) {
      let currentSetB = allowed.get(projectB);
      if (!currentSetB) {
        currentSetB = new Set<string>();
        allowed.set(projectB, currentSetB);
      }

      for (const projectA of setA) {
        currentSetB.add(projectA);
      }
    }
  }

  return allowed;
}
