import type {
  FileData,
  ProjectGraph,
  ProjectGraphProjectNode,
} from '@nrwl/devkit';

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
  const dependencies = graph.dependencies;
  const nodes = Object.keys(graph.nodes);
  const adjList = {};
  const matrix = {};

  const initMatrixValues = nodes.reduce((acc, value) => {
    return {
      ...acc,
      [value]: false,
    };
  }, {});

  nodes.forEach((v, i) => {
    adjList[nodes[i]] = [];
    matrix[nodes[i]] = { ...initMatrixValues };
  });

  for (let proj in dependencies) {
    for (let dep of dependencies[proj]) {
      if (graph.nodes[dep.target]) {
        adjList[proj].push(dep.target);
      }
    }
  }

  const traverse = (s, v) => {
    matrix[s][v] = true;

    for (let adj of adjList[v]) {
      if (matrix[s][adj] === false) {
        traverse(s, adj);
      }
    }
  };

  nodes.forEach((v, i) => {
    traverse(nodes[i], nodes[i]);
  });

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
    const result = buildMatrix(graph);
    reach.graph = graph;
    reach.matrix = result.matrix;
    reach.adjList = result.adjList;
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
    return path.map((n) => graph.nodes[n]);
  } else {
    return [];
  }
}

export function checkCircularPath(
  graph: ProjectGraph,
  sourceProject: ProjectGraphProjectNode,
  targetProject: ProjectGraphProjectNode
): Array<ProjectGraphProjectNode> {
  if (!graph.nodes[targetProject.name]) return [];

  return getPath(graph, targetProject.name, sourceProject.name);
}

export function findFilesInCircularPath(
  circularPath: ProjectGraphProjectNode[]
): Array<string[]> {
  const filePathChain = [];

  for (let i = 0; i < circularPath.length - 1; i++) {
    const next = circularPath[i + 1].name;
    const files: FileData[] = circularPath[i].data.files;
    filePathChain.push(
      Object.keys(files)
        .filter(
          (key) => files[key].deps && files[key].deps.indexOf(next) !== -1
        )
        .map((key) => files[key].file)
    );
  }

  return filePathChain;
}
