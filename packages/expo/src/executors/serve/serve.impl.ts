import { ExecutorContext, logger, names } from '@nx/devkit';
import { ChildProcess, fork } from 'child_process';
import { resolve as pathResolve } from 'path';
import { isPackagerRunning } from './lib/is-packager-running';
import { ExpoServeExecutorSchema } from './schema';

export interface ExpoServeOutput {
  port?: number;
  baseUrl?: string;
  success: boolean;
}

export default async function* serveExecutor(
  options: ExpoServeExecutorSchema,
  context: ExecutorContext
): AsyncGenerator<ExpoServeOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  const serveProcess = await runCliServe(context.root, projectRoot, options);

  yield {
    port: options.port,
    baseUrl: `http://localhost:${options.port}`,
    success: true,
  };

  if (!serveProcess) {
    return;
  }
  await new Promise<void>((resolve) => {
    const processExitListener = (signal?: number | NodeJS.Signals) => () => {
      serveProcess.kill(signal);
      resolve();
      process.exit();
    };
    process.once('exit', (signal) => serveProcess.kill(signal));
    process.once('SIGTERM', processExitListener);
    process.once('SIGINT', processExitListener);
    process.once('SIGQUIT', processExitListener);
  });
}

export async function runCliServe(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoServeExecutorSchema
): Promise<ChildProcess> {
  const result = await isPackagerRunning(options.port);
  if (result === 'running') {
    logger.info(`JS server already running on port ${options.port}.`);
  } else if (result === 'unrecognized') {
    logger.warn('JS server not recognized.');
  } else {
    // result === 'not_running'
    logger.info('Starting JS server...');

    try {
      return await serveAsync(workspaceRoot, projectRoot, options);
    } catch (error) {
      logger.error(
        `Failed to serve the packager server. Error details: ${error.message}`
      );
      throw error;
    }
  }
}

function serveAsync(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoServeExecutorSchema
): Promise<ChildProcess> {
  return new Promise<ChildProcess>((resolve, reject) => {
    const childProcess = fork(
      require.resolve('@expo/cli/build/bin/cli'),
      ['start', '--web', ...createServeOptions(options)],
      {
        cwd: pathResolve(workspaceRoot, projectRoot),
        env: process.env,
        stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      }
    );

    childProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
      if (data.toString().includes('Bundling complete')) {
        resolve(childProcess);
      }
    });
    childProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    childProcess.on('error', (err) => {
      reject(err);
    });
    childProcess.on('exit', (code) => {
      if (code === 0) {
        resolve(childProcess);
      } else {
        reject(code);
      }
    });
  });
}

function createServeOptions(options: ExpoServeExecutorSchema): string[] {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (k === 'dev') {
      if (v === false) {
        acc.push(`--no-dev`); // only no-dev flag is supported
      }
    } else {
      if (typeof v === 'boolean') {
        if (v === true) {
          // when true, does not need to pass the value true, just need to pass the flag in kebob case
          acc.push(`--${names(k).fileName}`);
        }
      } else {
        acc.push(`--${names(k).fileName}`, v);
      }
    }
    return acc;
  }, []);
}
