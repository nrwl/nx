import { exists, readFile, readFileSync, statSync, writeFileSync } from 'fs';
import { copySync } from 'fs-extra';
import * as http from 'http';
import * as opn from 'opn';
import { join, normalize, parse, dirname } from 'path';
import { ensureDirSync } from 'fs-extra';
import * as url from 'url';
import {
  createProjectGraph,
  onlyWorkspaceProjects,
  ProjectGraph,
  ProjectGraphNode,
} from '../core/project-graph';
import { appRootPath } from '../utilities/app-root';
import { output } from '../utilities/output';

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
  '.ttf': 'aplication/font-sfnt',
};

function projectsToHtml(
  projects: ProjectGraphNode[],
  graph: ProjectGraph,
  affected: string[],
  focus: string,
  groupByFolder: boolean,
  exclude: string[]
) {
  let f = readFileSync(
    join(__dirname, '../core/dep-graph/index.html')
  ).toString();

  f = f
    .replace(
      `window.projects = null`,
      `window.projects = ${JSON.stringify(projects)}`
    )
    .replace(`window.graph = null`, `window.graph = ${JSON.stringify(graph)}`)
    .replace(
      `window.affected = null`,
      `window.affected = ${JSON.stringify(affected)}`
    )
    .replace(
      `window.groupByFolder = null`,
      `window.groupByFolder = ${!!groupByFolder}`
    )
    .replace(
      `window.exclude = null`,
      `window.exclude = ${JSON.stringify(exclude)}`
    );

  if (focus) {
    f = f.replace(
      `window.focusedProject = null`,
      `window.focusedProject = '${focus}'`
    );
  }

  return f;
}

function projectExists(projects: ProjectGraphNode[], projectToFind: string) {
  return (
    projects.find((project) => project.name === projectToFind) !== undefined
  );
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
    visited.push(d.target);
    if (hasPath(graph, target, d.target, visited)) return true;
  }
  return false;
}

function filterGraph(
  graph: ProjectGraph,
  focus: string,
  exclude: string[]
): ProjectGraph {
  let projectNames = (Object.values(graph.nodes) as ProjectGraphNode[]).map(
    (project) => project.name
  );

  let filteredProjectNames: Set<string>;

  if (focus !== null) {
    filteredProjectNames = new Set<string>();
    projectNames.forEach((p) => {
      const isInPath =
        hasPath(graph, p, focus, []) || hasPath(graph, focus, p, []);

      if (isInPath) {
        filteredProjectNames.add(p);
      }
    });
  } else {
    filteredProjectNames = new Set<string>(projectNames);
  }

  if (exclude.length !== 0) {
    exclude.forEach((p) => filteredProjectNames.delete(p));
  }

  let filteredGraph: ProjectGraph = {
    nodes: {},
    dependencies: {},
  };

  filteredProjectNames.forEach((p) => {
    filteredGraph.nodes[p] = graph.nodes[p];
    filteredGraph.dependencies[p] = graph.dependencies[p];
  });

  return filteredGraph;
}

export function generateGraph(
  args: {
    file?: string;
    host?: string;
    port?: number;
    focus?: string;
    exclude?: string[];
    groupByFolder?: boolean;
  },
  affectedProjects: string[]
): void {
  let graph = onlyWorkspaceProjects(createProjectGraph());

  const projects = Object.values(graph.nodes) as ProjectGraphNode[];
  projects.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  if (args.focus !== undefined) {
    if (!projectExists(projects, args.focus)) {
      output.error({
        title: `Project to focus does not exist.`,
        bodyLines: [`You provided --focus=${args.focus}`],
      });
      process.exit(1);
    }
  }

  if (args.exclude !== undefined) {
    const invalidExcludes: string[] = [];

    args.exclude.forEach((project) => {
      if (!projectExists(projects, project)) {
        invalidExcludes.push(project);
      }
    });

    if (invalidExcludes.length > 0) {
      output.error({
        title: `The following projects provided to --exclude do not exist:`,
        bodyLines: invalidExcludes,
      });
      process.exit(1);
    }
  }

  let html: string;

  if (args.file === undefined || args.file.endsWith('html')) {
    html = projectsToHtml(
      projects,
      graph,
      affectedProjects,
      args.focus || null,
      args.groupByFolder || false,
      args.exclude || []
    );
  } else {
    graph = filterGraph(graph, args.focus || null, args.exclude || []);
  }

  if (args.file) {
    let folder = appRootPath;
    let filename = args.file;
    let ext = args.file.replace(/^.*\.(.*)$/, '$1');

    if (ext === 'html') {
      if (filename.includes('/')) {
        const [_match, _folder, _file] = /^(.*)\/([^/]*\.(.*))$/.exec(
          args.file
        );
        folder = `${appRootPath}/${_folder}`;
        filename = _file;
      }
      filename = `${folder}/${filename}`;

      const assetsFolder = `${folder}/static`;
      const assets: string[] = [];
      copySync(join(__dirname, '../core/dep-graph'), assetsFolder, {
        filter: (src, dest) => {
          const isntHtml = !/index\.html/.test(dest);
          if (isntHtml && dest.includes('.')) {
            assets.push(dest);
          }
          return isntHtml;
        },
      });

      html = html.replace(/src="/g, 'src="static/');
      html = html.replace(/href="styles/g, 'href="static/styles');
      html = html.replace('<base href="/">', '');
      html = html.replace(/type="module"/g, '');

      writeFileSync(filename, html);

      output.success({
        title: `HTML output created in ${folder}`,
        bodyLines: [filename, ...assets],
      });
    } else if (ext === 'json') {
      filename = `${folder}/${filename}`;

      ensureDirSync(dirname(filename));

      writeFileSync(
        filename,
        JSON.stringify(
          {
            graph,
            affectedProjects,
            criticalPath: affectedProjects,
          },
          null,
          2
        )
      );

      output.success({
        title: `JSON output created in ${folder}`,
        bodyLines: [filename],
      });
    } else {
      output.error({
        title: `Please specify a filename with either .json or .html extension.`,
        bodyLines: [`You provided --file=${args.file}`],
      });
      process.exit(1);
    }
  } else {
    startServer(html, args.host || '127.0.0.1', args.port || 4211);
  }
}

function startServer(html: string, host: string, port = 4211) {
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

    exists(pathname, function (exist) {
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
      readFile(pathname, function (err, data) {
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

  app.listen(port, host);

  output.note({
    title: `Dep graph started at http://${host}:${port}`,
  });

  opn(`http://${host}:${port}`, {
    wait: false,
  });
}
