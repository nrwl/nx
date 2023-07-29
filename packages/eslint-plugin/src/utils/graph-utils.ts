import type {
  FileData,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphProjectNode,
} from '@nx/devkit';
import {
  DependencyType,
  fileDataDepTarget,
  fileDataDepType,
} from 'nx/src/config/project-graph';

interface Reach {
  graph: ProjectGraph;
  matrix: Record<string, Array<string>>;
  adjList: Record<string, Array<string>>;
}

const reach: Reach = {
  graph: null,
  matrix: null,
  adjList: null,
};

function buildMatrix(graph: ProjectGraph) {
  const nodes = Object.keys(graph.nodes);
  const nodesLength = nodes.length;
  const adjList = {};
  const matrix = {};

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

  if (reach.graph !== graph) {
    const { matrix, adjList } = buildMatrix(graph);
    reach.graph = graph;
    reach.matrix = matrix;
    reach.adjList = adjList;
  }

  const adjList = reach.adjList;

  let path: string[] = [];
  const queue: Array<[string, string[]]> = [[sourceProjectName, path]];
  const visited: string[] = [sourceProjectName];

  while (queue.length > 0) {
    const [current, p] = queue.pop();
    path = [...p, current];

    if (current === targetProjectName) break;

    if (!adjList[current]) break;

    adjList[current]
      .filter((adj) => visited.indexOf(adj) === -1)
      .filter((adj) => reach.matrix[adj][targetProjectName])
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

  if (reach.graph !== graph) {
    const { matrix, adjList } = buildMatrix(graph);
    reach.graph = graph;
    reach.matrix = matrix;
    reach.adjList = adjList;
  }

  return !!reach.matrix[sourceProjectName][targetProjectName];
}

export function checkCircularPath(
  graph: ProjectGraph,
  sourceProject: ProjectGraphProjectNode,
  targetProject: ProjectGraphProjectNode
): ProjectGraphProjectNode[] {
  if (!graph.nodes[targetProject.name]) return [];

  return getPath(graph, targetProject.name, sourceProject.name);
}

export function findFilesInCircularPath(
  projectFileMap: ProjectFileMap,
  circularPath: ProjectGraphProjectNode[]
): Array<string[]> {
  const filePathChain = [];

  for (let i = 0; i < circularPath.length - 1; i++) {
    const next = circularPath[i + 1].name;
    const files: FileData[] = projectFileMap[circularPath[i].name] || [];
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
