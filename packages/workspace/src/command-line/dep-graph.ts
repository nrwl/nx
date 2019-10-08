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

  opn('http://localhost:4211', {
    wait: false
  });
}

export function generateGraph(
  args: { file?: string },
  affectedProjects: string[]
): void {
  const workspaceJson = readWorkspaceJson();
  const nxJson = readNxJson();
  const projects: ProjectNode[] = getProjectNodes(workspaceJson, nxJson);
  const deps = readDependencies(nxJson.npmScope, projects);

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
    startServer(projects, deps, affectedProjects);
  }
}
