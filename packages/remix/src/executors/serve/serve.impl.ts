import { workspaceRoot, type ExecutorContext } from '@nx/devkit';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';
import { fork } from 'node:child_process';
import { join } from 'node:path';
import { type RemixServeSchema } from './schema';

function normalizeOptions(schema: RemixServeSchema) {
  return {
    ...schema,
    port: schema.port ?? 4200,
    debug: schema.debug ?? false,
    manual: schema.manual ?? false,
  } as RemixServeSchema;
}

function buildRemixDevArgs(options: RemixServeSchema) {
  const args = [];

  if (options.command) {
    args.push(`--command=${options.command}`);
  }

  if (options.devServerPort) {
    args.push(`--port=${options.devServerPort}`);
  }

  if (options.debug) {
    args.push(`--debug`);
  }

  if (options.manual) {
    args.push(`--manual`);
  }

  if (options.tlsKey) {
    args.push(`--tls-key=${options.tlsKey}`);
  }

  if (options.tlsCert) {
    args.push(`--tls-cert=${options.tlsCert}`);
  }

  return args;
}

export default async function* serveExecutor(
  schema: RemixServeSchema,
  context: ExecutorContext
) {
  const options = normalizeOptions(schema);
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  const remixBin = require.resolve('@remix-run/dev/dist/cli');
  const args = buildRemixDevArgs(options);
  // Cast to any to overwrite NODE_ENV
  (process.env as any).NODE_ENV = process.env.NODE_ENV
    ? process.env.NODE_ENV
    : 'development';
  process.env.PORT = `${options.port}`;

  yield* createAsyncIterable<{ success: boolean; baseUrl: string }>(
    async ({ done, next, error }) => {
      const server = fork(remixBin, ['dev', ...args], {
        cwd: join(workspaceRoot, projectRoot),
        stdio: 'inherit',
      });

      server.once('exit', (code) => {
        if (code === 0) {
          done();
        } else {
          error(new Error(`Remix app exited with code ${code}`));
        }
      });

      const killServer = () => {
        if (server.connected) {
          server.kill('SIGTERM');
        }
      };
      process.on('exit', () => killServer());
      process.on('SIGINT', () => killServer());
      process.on('SIGTERM', () => killServer());
      process.on('SIGHUP', () => killServer());

      await waitForPortOpen(options.port);

      next({
        success: true,
        baseUrl: `http://localhost:${options.port}`,
      });
    }
  );
}
