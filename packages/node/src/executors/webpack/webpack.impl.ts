import 'dotenv/config';
import { ExecutorContext } from '@nrwl/devkit';
import { eachValueFrom } from '@nrwl/devkit/src/utils/rxjs-for-await';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { getRootTsConfigPath } from '@nrwl/workspace/src/utilities/typescript';

import { map, tap } from 'rxjs/operators';
import { resolve } from 'path';
import { register } from 'ts-node';

import { getNodeWebpackConfig } from '../../utils/node.config';
import { BuildNodeBuilderOptions } from '../../utils/types';
import { normalizeBuildOptions } from '../../utils/normalize';
import { deleteOutputDir } from '../../utils/fs';
import { runWebpack } from '../../utils/run-webpack';

export type NodeBuildEvent = {
  outfile: string;
  success: boolean;
};

export async function* webpackExecutor(
  rawOptions: BuildNodeBuilderOptions,
  context: ExecutorContext
) {
  const { sourceRoot, root } = context.workspace.projects[context.projectName];

  if (!sourceRoot) {
    throw new Error(`${context.projectName} does not have a sourceRoot.`);
  }

  if (!root) {
    throw new Error(`${context.projectName} does not have a root.`);
  }

  const options = normalizeBuildOptions(
    rawOptions,
    context.root,
    sourceRoot,
    root
  );

  if (options.webpackConfig.some((x) => x.endsWith('.ts'))) {
    registerTsNode();
  }

  if (!options.buildLibsFromSource) {
    const { target, dependencies } = calculateProjectDependencies(
      context.projectGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );
    options.tsConfig = createTmpTsConfig(
      options.tsConfig,
      context.root,
      target.data.root,
      dependencies
    );
  }

  // Delete output path before bundling
  if (options.deleteOutputPath) {
    deleteOutputDir(context.root, options.outputPath);
  }

  const config = await options.webpackConfig.reduce(
    async (currentConfig, plugin) => {
      return require(plugin)(await currentConfig, {
        options,
        configuration: context.configurationName,
      });
    },
    Promise.resolve(
      getNodeWebpackConfig(context, context.projectGraph, options)
    )
  );

  return yield* eachValueFrom(
    runWebpack(config).pipe(
      tap((stats) => {
        console.info(stats.toString(config.stats));
      }),
      map((stats) => {
        return {
          success: !stats.hasErrors(),
          outfile: resolve(
            context.root,
            options.outputPath,
            options.outputFileName
          ),
        } as NodeBuildEvent;
      })
    )
  );
}

function registerTsNode() {
  const rootTsConfig = getRootTsConfigPath();
  register({
    ...(rootTsConfig ? { project: rootTsConfig } : null),
  });
}

export default webpackExecutor;
