import { ExecutorContext, workspaceRoot } from '@nx/devkit';
import { VitestExecutorOptions } from './schema';
import { resolve } from 'path';
import { registerTsConfigPaths } from '@nx/js/src/internal';
import { NxReporter } from './lib/nx-reporter';
import { getExtraArgs, getOptions } from './lib/utils';

export async function* vitestExecutor(
  options: VitestExecutorOptions,
  context: ExecutorContext
) {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  registerTsConfigPaths(resolve(workspaceRoot, projectRoot, 'tsconfig.json'));

  process.env.VITE_CJS_IGNORE_WARNING = 'true';
  // Allows ESM to be required in CJS modules. Vite will be published as ESM in the future.
  const { startVitest } = await (Function(
    'return import("vitest/node")'
  )() as Promise<typeof import('vitest/node')>);

  const extraArgs = await getExtraArgs(options);
  const resolvedOptions =
    (await getOptions(options, context, projectRoot, extraArgs)) ?? {};

  const nxReporter = new NxReporter(resolvedOptions['watch']);
  if (resolvedOptions['reporters'] === undefined) {
    resolvedOptions['reporters'] = [];
  } else if (typeof resolvedOptions['reporters'] === 'string') {
    resolvedOptions['reporters'] = [resolvedOptions['reporters']];
  }
  resolvedOptions['reporters'].push(nxReporter);

  const cliFilters = options.testFiles ?? [];

  const ctx = await startVitest(
    resolvedOptions['mode'] ?? 'test',
    cliFilters,
    resolvedOptions
  );

  let hasErrors = false;

  const processExit = () => {
    ctx.exit();
    if (hasErrors) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  };

  if (resolvedOptions['watch'] === true) {
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

export default vitestExecutor;
