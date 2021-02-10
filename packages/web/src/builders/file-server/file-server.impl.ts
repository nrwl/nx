import watch from 'node-watch';
import { exec, execSync } from 'child_process';
import { ExecutorContext } from '@nrwl/devkit';
import ignore from 'ignore';
import { readFileSync } from 'fs-extra';

export interface FileServerOptions {
  host: string;
  port: number;
  ssl: boolean;
  sslKey?: string;
  sslCert?: string;
  proxyUrl?: string;
  buildTarget: string;
  parallel: boolean;
  maxParallel: number;
  withDeps: boolean;
}

function getHttpServerArgs(opts: FileServerOptions) {
  const args = [] as any[];
  if (opts.port) {
    args.push(`-p ${opts.port}`);
  }
  if (opts.host) {
    args.push(`-a ${opts.host}`);
  }
  if (opts.ssl) {
    args.push(`-S`);
  }
  if (opts.sslCert) {
    args.push(`-C ${opts.sslCert}`);
  }
  if (opts.sslKey) {
    args.push(`-K ${opts.sslKey}`);
  }
  if (opts.proxyUrl) {
    args.push(`-P ${opts.proxyUrl}`);
  }
  return args;
}

function getBuildTargetCommand(opts: FileServerOptions) {
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

function getBuildTargetOutputPath(
  opts: FileServerOptions,
  context: ExecutorContext
) {
  let buildOpts;
  try {
    const [project, target, config] = opts.buildTarget.split(':');

    const buildTarget = context.workspace.projects[project].targets[target];
    buildOpts = config
      ? { ...buildTarget.options, ...buildTarget.configurations[config] }
      : buildTarget.options;
  } catch (e) {
    throw new Error(`Invalid buildTarget: ${opts.buildTarget}`);
  }

  // TODO: vsavkin we should also check outputs
  const outputPath = buildOpts.outputPath;
  if (!outputPath) {
    throw new Error(
      `Invalid buildTarget: ${opts.buildTarget}. The target must contain outputPath property.`
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

export default async function (
  opts: FileServerOptions,
  context: ExecutorContext
) {
  let changed = true;
  let running = false;

  const fileFilter = getIgnoredGlobs(context.root).createFilter();
  // TODO: vsavkin create a transitive closure of all deps and watch src of all the packages in the closure
  watch('libs', { recursive: true, filter: fileFilter }, () => {
    changed = true;
    run();
  });
  watch('apps', { recursive: true, filter: fileFilter }, () => {
    changed = true;
    run();
  });

  function run() {
    if (changed && !running) {
      changed = false;
      running = true;
      try {
        execSync(getBuildTargetCommand(opts), {
          stdio: [0, 1, 2],
        });
      } catch (e) {}
      running = false;
      setTimeout(() => run(), 1000);
    }
  }

  const outputPath = getBuildTargetOutputPath(opts, context);
  const args = getHttpServerArgs(opts);
  run();

  const serve = exec(`npx http-server ${outputPath} ${args.join(' ')}`, {
    cwd: context.root,
  });
  serve.stdout.on('data', (chunk) => {
    if (chunk.toString().indexOf('GET') === -1) {
      process.stdout.write(chunk);
    }
  });
  serve.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

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
