import { printDiagnostics, runTypeCheck } from '@nx/js';
import { join, resolve } from 'path';
import { ViteBuildExecutorOptions } from '../executors/build/schema';
import { ExecutorContext } from '@nx/devkit';
import { ViteDevServerExecutorOptions } from '../executors/dev-server/schema';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
} from '@nx/js/src/utils/buildable-libs-utils';
import { registerTsConfigPaths } from '@nx/js/src/internal';

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

export function registerPaths(
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
    const tmpTsConfig = createTmpTsConfig(
      tsConfig,
      context.root,
      projectRoot,
      dependencies
    );

    registerTsConfigPaths(tmpTsConfig);
  } else {
    registerTsConfigPaths(tsConfig);
  }
}

/**
 * This function makes sure that the behaviour of Vite in replacing variables
 * that reference other variables is maintained in Nx.
 */
export function replaceEnvVarsWithinEnv() {
  const envVariablePattern = /(?<!\\)\$\{?(\w+)\}?/;

  for (const key in process.env) {
    if (
      Object.hasOwnProperty.call(process.env, key) &&
      key.startsWith('VITE_')
    ) {
      let value = process.env[key];

      let match: any;
      while ((match = envVariablePattern.exec(value))) {
        const fullMatch = match[0];
        const referencedKey = match[1];

        const replacement = process.env[referencedKey] || '';
        value = value.replace(fullMatch, replacement);
      }

      value = value.replace(/\\\$/g, '$');

      process.env[key] = value;
    }
  }
}
