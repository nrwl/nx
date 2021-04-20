import { execSync } from 'child_process';
import { ExecutorContext, logger } from '@nrwl/devkit';
import ignore from 'ignore';
import { readFileSync, existsSync, statSync } from 'fs';
import { watch } from 'chokidar';
import { Server, createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import * as connect from 'connect';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as serveStatic from 'serve-static';
import { Schema } from './schema';
import { join } from 'path';

function getBuildTargetCommand(opts: Schema) {
  const cmd = [`npx nx run ${opts.buildTarget}`];
  if (opts.withDeps) {
    cmd.push(`--with-deps`);
  }
  if (opts.parallel) {
    cmd.push(`--parallel`);
  }
  if (opts.maxParallel) {
    cmd.push(`--maxParallel=${opts.maxParallel}`);
  }
  return cmd.join(' ');
}

function getBuildTargetOutputPath(options: Schema, context: ExecutorContext) {
  let buildOpts;
  try {
    const [project, target, config] = options.buildTarget.split(':');

    const buildTarget = context.workspace.projects[project].targets[target];
    buildOpts = config
      ? { ...buildTarget.options, ...buildTarget.configurations[config] }
      : buildTarget.options;
  } catch (e) {
    throw new Error(`Invalid buildTarget: ${options.buildTarget}`);
  }

  // TODO: vsavkin we should also check outputs
  const outputPath = buildOpts.outputPath;
  if (!outputPath) {
    throw new Error(
      `Invalid buildTarget: ${options.buildTarget}. The target must contain outputPath property.`
    );
  }

  return outputPath;
}

function getIgnoredGlobs(root: string) {
  const ig = ignore();
  try {
    ig.add(readFileSync(`${root}/.gitignore`).toString());
  } catch (e) {}
  try {
    ig.add(readFileSync(`${root}/.nxignore`).toString());
  } catch (e) {}
  return ig;
}

function createFileWatcher(root: string, changeHandler: () => void) {
  const ignoredGlobs = getIgnoredGlobs(root);

  const watcher = watch(['./apps/**', './libs/**'], {
    ignoreInitial: true,
    persistent: true,
    cwd: root,
  });
  watcher.on('all', (_event: string, path: string) => {
    if (ignoredGlobs.ignores(path)) return;
    changeHandler();
  });
  return { close: () => watcher.close() };
}

export default async function* fileServerExecutor(
  options: Schema,
  context: ExecutorContext
) {
  let changed = true;
  let running = false;

  const watcher = createFileWatcher(context.root, () => {
    changed = true;
    run();
  });

  function run() {
    if (changed && !running) {
      changed = false;
      running = true;
      try {
        execSync(getBuildTargetCommand(options), {
          stdio: [0, 1, 2],
        });
      } catch (e) {}
      running = false;
      setTimeout(() => run(), 1000);
    }
  }
  run();

  const outputPath = getBuildTargetOutputPath(options, context);

  const app = connect();

  app.use(serveStatic(outputPath, { fallthrough: true }));

  if (options.proxyUrl) {
    app.use(createProxyMiddleware({ target: options.proxyUrl }));
  } else {
    // SPA Fallback to index.html
    app.use((_req, res, next) => {
      const path = join(outputPath, 'index.html');

      if (existsSync(path) && statSync(path).isFile()) {
        const content = readFileSync(path, { encoding: 'utf-8' });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(content);
      } else {
        next();
      }
    });
  }

  let server: Server;

  if (!options.ssl) {
    server = createServer(app);
  } else {
    if (!options.sslCert) {
      throw new Error('No SSL Certificate provided!');
    }
    if (!options.sslKey) {
      throw new Error('No SSL Key provided!');
    }

    server = createHttpsServer(
      {
        cert: readFileSync(options.sslCert),
        key: readFileSync(options.sslKey),
      },
      app
    );
  }

  const serverUrl = `${options.ssl ? 'https' : 'http'}://${options.host}:${
    options.port
  }`;

  server.listen(options.port, options.host, () => {
    logger.info(`NX File Server is listening at ${serverUrl}`);
  });

  const processExitListener = () => {
    server.close();
    watcher.close();
  };
  process.on('exit', processExitListener);

  server.on('close', () => {
    process.removeListener('exit', processExitListener);
  });

  yield {
    success: true,
    baseUrl: serverUrl,
  };

  return new Promise<{ success: boolean }>((resolve) => {
    server.on('exit', () => {
      return resolve({ success: true });
    });
  });
}
