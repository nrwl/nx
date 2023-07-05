import { printDiagnostics, runTypeCheck } from '@nx/js';
import { join, resolve } from 'path';
import { ViteBuildExecutorOptions } from '../executors/build/schema';
import { ExecutorContext } from '@nx/devkit';
import { ViteDevServerExecutorOptions } from '../executors/dev-server/schema';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
} from '@nx/js/src/utils/buildable-libs-utils';

export async function validateTypes(opts: {
  workspaceRoot: string;
  projectRoot: string;
  tsconfig: string;
}): Promise<void> {
  const result = await runTypeCheck({
    workspaceRoot: opts.workspaceRoot,
    tsConfigPath: join(opts.workspaceRoot, opts.tsconfig),
    mode: 'noEmit',
  });

  await printDiagnostics(result.errors, result.warnings);

  if (result.errors.length > 0) {
    throw new Error('Found type errors. See above.');
  }
}

export function createBuildableTsConfig(
  projectRoot: string,
  options: ViteBuildExecutorOptions | ViteDevServerExecutorOptions,
  context: ExecutorContext
) {
  const tsConfig = resolve(projectRoot, 'tsconfig.json');
  options.buildLibsFromSource ??= true;

  if (!options.buildLibsFromSource) {
    const { dependencies } = calculateProjectDependencies(
      context.projectGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );
    // this tsconfig is used via the vite ts paths plugin
    createTmpTsConfig(tsConfig, context.root, projectRoot, dependencies);
  }
}
