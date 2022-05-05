import { execFileSync, fork } from 'child_process';
import {
  ExecutorContext,
  joinPathFragments,
  readJsonFile,
  workspaceLayout,
} from '@nrwl/devkit';
import ignore from 'ignore';
import { readFileSync } from 'fs';
import { Schema } from './schema';
import { watch } from 'chokidar';
import { platform } from 'os';
import { resolve } from 'path';

// platform specific command name
const pmCmd = platform() === 'win32' ? `npx.cmd` : 'npx';

function getHttpServerArgs(options: Schema) {
  const args = ['-c-1'];
  if (options.port) {
    args.push(`-p=${options.port}`);
  }
  if (options.host) {
    args.push(`-a=${options.host}`);
  }
  if (options.ssl) {
    args.push(`-S`);
  }
  if (options.sslCert) {
    args.push(`-C=${options.sslCert}`);
  }
  if (options.sslKey) {
    args.push(`-K=${options.sslKey}`);
  }
  if (options.proxyUrl) {
    args.push(`-P=${options.proxyUrl}`);
  }

  if (options.proxyOptions) {
    Object.keys(options.proxyOptions).forEach((key) => {
      args.push(`--proxy-options.${key}=options.proxyOptions[key]`);
    });
  }

  args.push('--cors');
  return args;
}

function getBuildTargetCommand(options: Schema) {
  const cmd = ['nx', 'run', options.buildTarget];
  if (options.withDeps) {
    cmd.push(`--with-deps`);
  }
  if (options.parallel) {
    cmd.push(`--parallel`);
  }
  if (options.maxParallel) {
    cmd.push(`--maxParallel=${options.maxParallel}`);
  }
  return cmd;
}

function getBuildTargetOutputPath(options: Schema, context: ExecutorContext) {
  let buildOptions;
  try {
    const [project, target, config] = options.buildTarget.split(':');

    const buildTarget = context.workspace.projects[project].targets[target];
    buildOptions = config
      ? { ...buildTarget.options, ...buildTarget.configurations[config] }
      : buildTarget.options;
  } catch (e) {
    throw new Error(`Invalid buildTarget: ${options.buildTarget}`);
  }

  // TODO: vsavkin we should also check outputs
  const outputPath = buildOptions.outputPath;
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
    ig.add(readFileSync(`${root}/.gitignore`, 'utf-8'));
  } catch {}
  try {
    ig.add(readFileSync(`${root}/.nxignore`, 'utf-8'));
  } catch {}
  return ig;
}

function createFileWatcher(
  root: string,
  changeHandler: () => void
): () => void {
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
  watcher.on('all', (_event: string, path: string) => {
    if (ignoredGlobs.ignores(path)) return;
    changeHandler();
  });
  return () => watcher.close();
}

export default async function* fileServerExecutor(
  options: Schema,
  context: ExecutorContext
) {
  let running = false;

  const run = () => {
    if (!running) {
      running = true;
      try {
        const args = getBuildTargetCommand(options);
        execFileSync(pmCmd, args, {
          stdio: [0, 1, 2],
        });
      } catch {}
      running = false;
    }
  };

  let disposeWatch: () => void;
  if (options.watch) {
    disposeWatch = createFileWatcher(context.root, run);
  }

  // perform initial run
  run();

  const outputPath = getBuildTargetOutputPath(options, context);
  const args = getHttpServerArgs(options);

  const pathToHttpServerPkgJson = require.resolve('http-server/package.json');
  const pathToHttpServerBin = readJsonFile(pathToHttpServerPkgJson).bin[
    'http-server'
  ];
  const pathToHttpServer = resolve(
    pathToHttpServerPkgJson.replace('package.json', ''),
    pathToHttpServerBin
  );

  const serve = fork(pathToHttpServer, [outputPath, ...args], {
    stdio: 'pipe',
    cwd: context.root,
    env: {
      FORCE_COLOR: 'true',
      ...process.env,
    },
  });

  const processExitListener = () => {
    serve.kill();
    if (disposeWatch) {
      disposeWatch();
    }
  };
  process.on('exit', processExitListener);
  process.on('SIGTERM', processExitListener);
  serve.stdout.on('data', (chunk) => {
    if (chunk.toString().indexOf('GET') === -1) {
      process.stdout.write(chunk);
    }
  });
  serve.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  yield {
    success: true,
    baseUrl: `${options.ssl ? 'https' : 'http'}://${options.host}:${
      options.port
    }`,
  };

  return new Promise<{ success: boolean }>((res) => {
    serve.on('exit', (code) => {
      if (code == 0) {
        res({ success: true });
      } else {
        res({ success: false });
      }
    });
  });
}
