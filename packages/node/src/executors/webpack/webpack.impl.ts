import { ExecutorContext, readCachedProjectGraph } from '@nrwl/devkit';
import { getHelperDependenciesFromProjectGraph } from '@nrwl/js/src/utils/compiler-helper-dependency';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { getRootTsConfigPath } from '@nrwl/workspace/src/utilities/typescript';
import 'dotenv/config';
import { resolve } from 'path';
import { eachValueFrom } from 'rxjs-for-await';

import { map, tap } from 'rxjs/operators';
import { register } from 'ts-node';
import { generatePackageJson } from '../../utils/generate-package-json';

import { getNodeWebpackConfig } from '../../utils/node.config';
import { normalizeBuildOptions } from '../../utils/normalize';
import { runWebpack } from '../../utils/run-webpack';
import { BuildNodeBuilderOptions } from '../../utils/types';

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

  const projGraph = readCachedProjectGraph();
  if (!options.buildLibsFromSource) {
    const { target, dependencies } = calculateProjectDependencies(
      projGraph,
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

    if (
      !checkDependentProjectsHaveBeenBuilt(
        context.root,
        context.projectName,
        context.targetName,
        dependencies
      )
    ) {
      return { success: false } as any;
    }
  }

  if (options.generatePackageJson) {
    const helperDependencies = getHelperDependenciesFromProjectGraph(
      context.root,
      context.projectName
    );
    if (helperDependencies.length > 0) {
      projGraph.dependencies[context.projectName] =
        projGraph.dependencies[context.projectName].concat(helperDependencies);
    }
    generatePackageJson(context.projectName, projGraph, options);
  }
  const config = await options.webpackConfig.reduce(
    async (currentConfig, plugin) => {
      return require(plugin)(await currentConfig, {
        options,
        configuration: context.configurationName,
      });
    },
    Promise.resolve(getNodeWebpackConfig(options))
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
