import { ExecutorContext } from '@nrwl/devkit';
import { File, Reporter } from 'vitest';
import { VitestExecutorOptions } from './schema';

class NxReporter implements Reporter {
  deferred: {
    promise: Promise<boolean>;
    resolve: (val: boolean) => void;
  };

  constructor(private watch: boolean) {
    this.setupDeferred();
  }

  async *[Symbol.asyncIterator]() {
    do {
      const hasErrors = await this.deferred.promise;
      yield { hasErrors };
      this.setupDeferred();
    } while (this.watch);
  }

  private setupDeferred() {
    let resolve: (val: boolean) => void;
    this.deferred = {
      promise: new Promise((res) => {
        resolve = res;
      }),
      resolve,
    };
  }

  onFinished(files: File[], errors?: unknown[]) {
    const hasErrors =
      files.some((f) => f.result?.state === 'fail') || errors?.length > 0;
    this.deferred.resolve(hasErrors);
  }
}

export default async function* runExecutor(
  options: VitestExecutorOptions,
  context: ExecutorContext
) {
  const { startVitest } = await (Function(
    'return import("vitest/node")'
  )() as Promise<typeof import('vitest/node')>);

  const projectRoot = context.projectGraph.nodes[context.projectName].data.root;

  const nxReporter = new NxReporter(options.watch);
  const settings = {
    ...options,
    root: projectRoot,
    reporters: [...(options.reporters ?? []), 'default', nxReporter],
    // if reportsDirectory is not provides vitest will remove all files in the project root
    // when coverage is enabled in the vite.config.ts
    ...(options.reportsDirectory
      ? {
          coverage: {
            reportsDirectory: options.reportsDirectory,
          },
        }
      : {}),
  };

  const ctx = await startVitest(options.mode, [], settings);

  let hasErrors = false;

  const processExit = () => {
    ctx.exit();
    if (hasErrors) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  };

  if (options.watch) {
    process.on('SIGINT', processExit);
    process.on('SIGTERM', processExit);
    process.on('exit', processExit);
  }

  for await (const report of nxReporter) {
    // vitest sets the exitCode = 1 when code coverage isn't met
    hasErrors =
      report.hasErrors || (process.exitCode && process.exitCode !== 0);
  }

  return {
    success: !hasErrors,
  };
}
