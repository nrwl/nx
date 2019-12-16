import { readFileSync, writeFileSync } from 'fs';
import * as http from 'http';
import * as opn from 'opn';
import {
  createProjectGraph,
  onlyWorkspaceProjects,
  ProjectGraph,
  ProjectGraphNode
} from '../core/project-graph';
import { output } from '../utils/output';
import { join } from 'path';

export function generateGraph(
  args: { file?: string; filter?: string[]; exclude?: string[] },
  affectedProjects: string[]
): void {
  const graph = onlyWorkspaceProjects(createProjectGraph());

  const renderProjects: ProjectGraphNode[] = filterProjects(
    graph,
    args.filter,
    args.exclude
  );

  if (args.file) {
    writeFileSync(
      args.file,
      JSON.stringify(
        {
          graph,
          affectedProjects,
          criticalPath: affectedProjects
        },
        null,
        2
      )
    );
  } else {
    startServer(renderProjects, graph, affectedProjects);
  }
}

function startServer(
  projects: ProjectGraphNode[],
  graph: ProjectGraph,
  affected: string[]
) {
  const f = readFileSync(
    join(__dirname, '../core/dep-graph/dep-graph.html')
  ).toString();
  const html = f
    .replace(
      `window.projects = null`,
      `window.projects = ${JSON.stringify(projects)}`
    )
    .replace(`window.graph = null`, `window.graph = ${JSON.stringify(graph)}`)
    .replace(
      `window.affected = null`,
      `window.affected = ${JSON.stringify(affected)}`
    );

  const app = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  app.listen(4211, '127.0.0.1');
  output.note({
    title: 'Dep graph started at http://localhost:4211'
  });

  opn('http://localhost:4211', {
    wait: false
  });
}

function filterProjects(
  graph: ProjectGraph,
  filter: string[],
  exclude: string[]
) {
  const filteredProjects = Object.values(graph.nodes).filter(p => {
    const filtered =
      filter && filter.length > 0
        ? filter.find(
            f => hasPath(graph, f, p.name, []) || hasPath(graph, p.name, f, [])
          )
        : true;
    return !exclude
      ? filtered
      : exclude && exclude.indexOf(p.name) === -1 && filtered;
  });

  return filteredProjects;
}

function hasPath(
  graph: ProjectGraph,
  target: string,
  node: string,
  visited: string[]
) {
  if (target === node) return true;

  for (let d of graph.dependencies[node] || []) {
    if (visited.indexOf(d.target) > -1) continue;
    if (hasPath(graph, target, d.target, [...visited, d.target])) return true;
  }
  return false;
}
