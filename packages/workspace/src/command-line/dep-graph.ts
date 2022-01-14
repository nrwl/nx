import { joinPathFragments } from '@nrwl/devkit/src/utils/path';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { watch } from 'chokidar';
import { createHash } from 'crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { copySync, ensureDirSync } from 'fs-extra';
import * as http from 'http';
import ignore from 'ignore';
import * as open from 'open';
import { basename, dirname, extname, isAbsolute, join, parse } from 'path';
import { ProjectGraphProjectNode, writeJsonFile } from '@nrwl/devkit';
import { performance } from 'perf_hooks';
import { URL, URLSearchParams } from 'url';
import { workspaceLayout } from '../core/file-utils';
import { defaultFileHasher } from '../core/hasher/file-hasher';
import {
  createProjectGraphAsync,
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphNode,
  pruneExternalNodes,
} from '../core/project-graph';
import { output } from '../utilities/output';

export interface DepGraphClientResponse {
  hash: string;
  projects: ProjectGraphNode[];
  dependencies: Record<string, ProjectGraphDependency[]>;
  layout: { appsDir: string; libsDir: string };
  affected: string[];
  focus: string;
  groupByFolder: boolean;
  exclude: string[];
}

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

function buildEnvironmentJs(
  exclude: string[],
  watchMode: boolean,
  localMode: 'build' | 'serve',
  depGraphClientResponse?: DepGraphClientResponse
) {
  let environmentJs = `window.exclude = ${JSON.stringify(exclude)};
  window.watch = ${!!watchMode};
  window.environment = 'release';
  window.localMode = '${localMode}';
  
  window.appConfig = {
    showDebugger: false,
    projectGraphs: [
      {
        id: 'local',
        label: 'local',
        url: 'projectGraph.json',
      }
    ],
    defaultProjectGraph: 'local',
  };
  `;

  if (localMode === 'build') {
    environmentJs += `window.projectGraphResponse = ${JSON.stringify(
      depGraphClientResponse
    )};`;
  } else {
    environmentJs += `window.projectGraphResponse = null;`;
  }

  return environmentJs;
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

export async function generateGraph(
  args: {
    file?: string;
    host?: string;
    port?: number;
    focus?: string;
    exclude?: string[];
    groupByFolder?: boolean;
    watch?: boolean;
    open?: boolean;
  },
  affectedProjects: string[]
): Promise<void> {
  let graph = pruneExternalNodes(await createProjectGraphAsync());
  const layout = workspaceLayout();

  const projects = Object.values(graph.nodes) as ProjectGraphNode[];
  projects.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  if (args.focus) {
    if (!projectExists(projects, args.focus)) {
      output.error({
        title: `Project to focus does not exist.`,
        bodyLines: [`You provided --focus=${args.focus}`],
      });
      process.exit(1);
    }
  }

  if (args.exclude) {
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

  let html = readFileSync(
    join(__dirname, '../core/dep-graph/index.html'),
    'utf-8'
  );

  graph = filterGraph(graph, args.focus || null, args.exclude || []);

  if (args.file) {
    const workspaceFolder = appRootPath;
    const ext = extname(args.file);
    const fullFilePath = isAbsolute(args.file)
      ? args.file
      : join(workspaceFolder, args.file);
    const fileFolderPath = dirname(fullFilePath);

    if (ext === '.html') {
      const assetsFolder = join(fileFolderPath, 'static');
      const assets: string[] = [];
      copySync(join(__dirname, '../core/dep-graph'), assetsFolder, {
        filter: (_src, dest) => {
          const isntHtml = !/index\.html/.test(dest);
          if (isntHtml && dest.includes('.')) {
            assets.push(dest);
          }
          return isntHtml;
        },
      });

      const depGraphClientResponse = await createDepGraphClientResponse();

      const environmentJs = buildEnvironmentJs(
        args.exclude || [],
        args.watch,
        !!args.file && args.file.endsWith('html') ? 'build' : 'serve',
        depGraphClientResponse
      );
      html = html.replace(/src="/g, 'src="static/');
      html = html.replace(/href="styles/g, 'href="static/styles');
      html = html.replace('<base href="/" />', '');
      html = html.replace(/type="module"/g, '');

      writeFileSync(fullFilePath, html);
      writeFileSync(join(assetsFolder, 'environment.js'), environmentJs);

      output.success({
        title: `HTML output created in ${fileFolderPath}`,
        bodyLines: [fileFolderPath, ...assets],
      });
    } else if (ext === '.json') {
      ensureDirSync(dirname(fullFilePath));

      writeJsonFile(fullFilePath, {
        graph,
        affectedProjects,
        criticalPath: affectedProjects,
      });

      output.success({
        title: `JSON output created in ${fileFolderPath}`,
        bodyLines: [fullFilePath],
      });
    } else {
      output.error({
        title: `Please specify a filename with either .json or .html extension.`,
        bodyLines: [`You provided --file=${args.file}`],
      });
      process.exit(1);
    }
  } else {
    const environmentJs = buildEnvironmentJs(
      args.exclude || [],
      args.watch,
      !!args.file && args.file.endsWith('html') ? 'build' : 'serve'
    );

    await startServer(
      html,
      environmentJs,
      args.host || '127.0.0.1',
      args.port || 4211,
      args.watch,
      affectedProjects,
      args.focus,
      args.groupByFolder,
      args.exclude,
      args.open
    );
  }
}

async function startServer(
  html: string,
  environmentJs: string,
  host: string,
  port = 4211,
  watchForchanges = false,
  affected: string[] = [],
  focus: string = null,
  groupByFolder: boolean = false,
  exclude: string[] = [],
  openBrowser: boolean = true
) {
  if (watchForchanges) {
    startWatcher();
  }

  currentDepGraphClientResponse = await createDepGraphClientResponse();
  currentDepGraphClientResponse.affected = affected;
  currentDepGraphClientResponse.focus = focus;
  currentDepGraphClientResponse.groupByFolder = groupByFolder;
  currentDepGraphClientResponse.exclude = exclude;

  const app = http.createServer((req, res) => {
    // parse URL
    const parsedUrl = new URL(req.url, `http://${host}:${port}`);
    // extract URL path
    // Avoid https://en.wikipedia.org/wiki/Directory_traversal_attack
    // e.g curl --path-as-is http://localhost:9000/../fileInDanger.txt
    // by limiting the path to current directory only

    const sanitizePath = basename(parsedUrl.pathname);

    if (sanitizePath === 'projectGraph.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(currentDepGraphClientResponse));
      return;
    }

    if (sanitizePath === 'currentHash') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hash: currentDepGraphClientResponse.hash }));
      return;
    }

    if (sanitizePath === 'environment.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(environmentJs);
      return;
    }

    let pathname = join(__dirname, '../core/dep-graph/', sanitizePath);

    if (!existsSync(pathname)) {
      // if the file is not found, return 404
      res.statusCode = 404;
      res.end(`File ${pathname} not found!`);
      return;
    }

    // if is a directory, then look for index.html
    if (statSync(pathname).isDirectory()) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    try {
      const data = readFileSync(pathname);

      const ext = parse(pathname).ext;
      res.setHeader('Content-type', mimeType[ext] || 'text/plain');
      res.end(data);
    } catch (err) {
      res.statusCode = 500;
      res.end(`Error getting the file: ${err}.`);
    }
  });

  app.listen(port, host);

  output.note({
    title: `Project graph started at http://${host}:${port}`,
  });

  if (openBrowser) {
    let url = `http://${host}:${port}`;
    let params = new URLSearchParams();

    if (focus) {
      params.append('focus', focus);
    }

    if (groupByFolder) {
      params.append('groupByFolder', 'true');
    }

    open(`${url}?${params.toString()}`);
  }
}

let currentDepGraphClientResponse: DepGraphClientResponse = {
  hash: null,
  projects: [],
  dependencies: {},
  layout: {
    appsDir: '',
    libsDir: '',
  },
  affected: [],
  focus: null,
  groupByFolder: false,
  exclude: [],
};

function getIgnoredGlobs(root: string) {
  const ig = ignore();
  try {
    ig.add(readFileSync(`${root}/.gitignore`, 'utf-8'));
  } catch {}
  try {
    ig.add(readFileSync(`${root}/.nxignore`, 'utf-8'));
  } catch {}
  return ig;
}

function startWatcher() {
  createFileWatcher(appRootPath, async () => {
    output.note({ title: 'Recalculating project graph...' });

    const newGraphClientResponse = await createDepGraphClientResponse();

    if (newGraphClientResponse.hash !== currentDepGraphClientResponse.hash) {
      output.note({ title: 'Graph changes updated.' });

      currentDepGraphClientResponse = newGraphClientResponse;
    } else {
      output.note({ title: 'No graph changes found.' });
    }
  });
}

function debounce(fn: (...args) => void, time: number) {
  let timeout: NodeJS.Timeout;

  return (...args) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => fn(...args), time);
  };
}

function createFileWatcher(root: string, changeHandler: () => Promise<void>) {
  const ignoredGlobs = getIgnoredGlobs(root);
  const layout = workspaceLayout();

  const watcher = watch(
    [
      joinPathFragments(layout.appsDir, '**'),
      joinPathFragments(layout.libsDir, '**'),
    ],
    {
      cwd: root,
      ignoreInitial: true,
    }
  );
  watcher.on(
    'all',
    debounce(async (event: string, path: string) => {
      if (ignoredGlobs.ignores(path)) return;
      await changeHandler();
    }, 500)
  );
  return { close: () => watcher.close() };
}

async function createDepGraphClientResponse(): Promise<DepGraphClientResponse> {
  performance.mark('project graph watch calculation:start');
  await defaultFileHasher.init();

  let graph = pruneExternalNodes(await createProjectGraphAsync());
  performance.mark('project graph watch calculation:end');
  performance.mark('project graph response generation:start');

  const layout = workspaceLayout();
  const projects: ProjectGraphProjectNode[] = Object.values(graph.nodes).map(
    (project) =>
      ({
        name: project.name,
        type: project.type,
        data: {
          tags: project.data.tags,
          root: project.data.root,
          files: [],
        },
      } as ProjectGraphProjectNode)
  );

  const dependencies = graph.dependencies;

  const hasher = createHash('sha256');
  hasher.update(JSON.stringify({ layout, projects, dependencies }));

  const hash = hasher.digest('hex');

  performance.mark('project graph response generation:end');

  performance.measure(
    'project graph watch calculation',
    'project graph watch calculation:start',
    'project graph watch calculation:end'
  );

  performance.measure(
    'project graph response generation',
    'project graph response generation:start',
    'project graph response generation:end'
  );

  return {
    ...currentDepGraphClientResponse,
    hash,
    layout,
    projects,
    dependencies,
  };
}
