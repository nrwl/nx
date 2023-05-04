import {
  ExecutorContext,
  logger,
  stripIndents,
  workspaceRoot,
} from '@nx/devkit';
import { CoverageOptions, File, Reporter } from 'vitest';
import { loadConfigFromFile } from 'vite';
import { VitestExecutorOptions } from './schema';
import { join, relative } from 'path';
import { existsSync } from 'fs';

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

export async function* vitestExecutor(
  options: VitestExecutorOptions,
  context: ExecutorContext
) {
  const { startVitest } = await (Function(
    'return import("vitest/node")'
  )() as Promise<typeof import('vitest/node')>);

  const nxReporter = new NxReporter(options.watch);
  const settings = await getSettings(options, context);
  settings.reporters.push(nxReporter);
  const cliFilters = options.testFile ? [options.testFile] : [];

  const ctx = await startVitest(options.mode, cliFilters, settings);

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

async function getSettings(
  options: VitestExecutorOptions,
  context: ExecutorContext
) {
  const projectRoot = context.projectGraph.nodes[context.projectName].data.root;
  const offset = relative(workspaceRoot, context.cwd);
  // if reportsDirectory is not provides vitest will remove all files in the project root
  // when coverage is enabled in the vite.config.ts
  const coverage: CoverageOptions = options.reportsDirectory
    ? {
        enabled: options.coverage,
        reportsDirectory: options.reportsDirectory,
      }
    : {};

  const viteConfigPath = options.config
    ? join(context.root, options.config)
    : findViteConfig(join(context.root, projectRoot));

  const resolved = await loadConfigFromFile(
    {
      mode: options.mode,
      command: 'serve',
    },
    viteConfigPath
  );

  if (!viteConfigPath || !resolved?.config?.test) {
    logger.warn(stripIndents`Unable to load test config from config file ${
      resolved?.path ?? viteConfigPath
    }
Some settings may not be applied as expected.
You can manually set the config in the project, ${
      context.projectName
    }, configuration.
      `);
  }

  const settings = {
    ...options,
    // when running nx from the project root, the root will get appended to the cwd.
    // creating an invalid path and no tests will be found.
    // instead if we are not at the root, let the cwd be root.
    root: offset === '' ? projectRoot : '',
    reporters: [
      ...(options.reporters ?? []),
      ...((resolved?.config?.test?.reporters as string[]) ?? []),
      'default',
    ] as (string | Reporter)[],
    coverage: { ...resolved?.config?.test?.coverage, ...coverage },
  };

  return settings;
}

function findViteConfig(projectRootFullPath: string): string {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    if (existsSync(join(projectRootFullPath, `vite.config.${ext}`))) {
      return join(projectRootFullPath, `vite.config.${ext}`);
    }
  }
}

export default vitestExecutor;
