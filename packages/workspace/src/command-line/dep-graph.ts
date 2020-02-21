import { readFileSync, readFile, writeFileSync, exists, statSync } from 'fs';
import * as http from 'http';
import * as opn from 'opn';
import * as url from 'url';
import {
  createProjectGraph,
  onlyWorkspaceProjects,
  ProjectGraph,
  ProjectGraphNode
} from '../core/project-graph';
import { output } from '../utils/output';
import { join, normalize, parse } from 'path';

// maps file extention to MIME types
const mimeType = {
  '.ico': 'image/x-icon',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.eot': 'appliaction/vnd.ms-fontobject',
  '.ttf': 'aplication/font-sfnt'
};

export function generateGraph(
  args: { file?: string; filter?: string[]; exclude?: string[]; host?: string },
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
    startServer(
      renderProjects,
      graph,
      affectedProjects,
      args.host || '127.0.0.1'
    );
  }
}

function startServer(
  projects: ProjectGraphNode[],
  graph: ProjectGraph,
  affected: string[],
  host: string
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
    // parse URL
    const parsedUrl = url.parse(req.url);

    // extract URL path
    // Avoid https://en.wikipedia.org/wiki/Directory_traversal_attack
    // e.g curl --path-as-is http://localhost:9000/../fileInDanger.txt
    // by limiting the path to current directory only
    const sanitizePath = normalize(parsedUrl.pathname).replace(
      /^(\.\.[\/\\])+/,
      ''
    );
    let pathname = join(__dirname, '../core/dep-graph/', sanitizePath);

    exists(pathname, function(exist) {
      if (!exist) {
        // if the file is not found, return 404
        res.statusCode = 404;
        res.end(`File ${pathname} not found!`);
        return;
      }

      // if is a directory, then look for index.html
      if (statSync(pathname).isDirectory()) {
        // pathname += '/index.html';
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }

      // read file from file system
      readFile(pathname, function(err, data) {
        if (err) {
          res.statusCode = 500;
          res.end(`Error getting the file: ${err}.`);
        } else {
          // based on the URL path, extract the file extention. e.g. .js, .doc, ...
          const ext = parse(pathname).ext;
          // if the file is found, set Content-type and send data
          res.setHeader('Content-type', mimeType[ext] || 'text/plain');
          res.end(data);
        }
      });
    });
  });

  app.listen(4211, host);

  output.note({
    title: `Dep graph started at http://${host}:4211`
  });

  opn(`http://${host}:4211`, {
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
