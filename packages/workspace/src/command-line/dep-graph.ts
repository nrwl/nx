import { readFileSync, writeFileSync } from 'fs';
import * as http from 'http';
import * as opn from 'opn';
import { Deps, readDependencies } from './deps-calculator';
import {
  getProjectNodes,
  readNxJson,
  readWorkspaceJson,
  ProjectNode
} from './shared';
import { output } from './output';

export function startServer(
  projects: ProjectNode[],
  deps: Deps,
  affected: string[]
) {
  const f = readFileSync(__dirname + '/dep-graph/dep-graph.html').toString();
  const html = f
    .replace(
      `window.projects = null`,
      `window.projects = ${JSON.stringify(projects)}`
    )
    .replace(`window.deps = null`, `window.deps = ${JSON.stringify(deps)}`)
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

export function generateGraph(
  args: { file?: string; filter?: string[]; exclude?: string[] },
  affectedProjects: string[]
): void {
  const workspaceJson = readWorkspaceJson();
  const nxJson = readNxJson();
  const projects: ProjectNode[] = getProjectNodes(workspaceJson, nxJson);
  const deps = readDependencies(nxJson.npmScope, projects);

  const renderProjects: ProjectNode[] = filterProjects(
    deps,
    projects,
    args.filter,
    args.exclude
  );

  if (args.file) {
    writeFileSync(
      args.file,
      JSON.stringify(
        {
          deps,
          affectedProjects,
          criticalPath: affectedProjects
        },
        null,
        2
      )
    );
  } else {
    startServer(renderProjects, deps, affectedProjects);
  }
}

export function filterProjects(deps, projects, filter, exclude) {
  const filteredProjects = projects.filter(p => {
    const filtered =
      filter && filter.length > 0
        ? filter.find(
            f => hasPath(deps, f, p.name, []) || hasPath(deps, p.name, f, [])
          )
        : true;
    return !exclude
      ? filtered
      : exclude && exclude.indexOf(p.name) === -1 && filtered;
  });

  return filteredProjects;
}

export function hasPath(deps, target, node, visited) {
  if (target === node) return true;

  for (let d of deps[node]) {
    if (visited.indexOf(d.projectName) > -1) continue;
    if (hasPath(deps, target, d.projectName, [...visited, d.projectName]))
      return true;
  }
  return false;
}
