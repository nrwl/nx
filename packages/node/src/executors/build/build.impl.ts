import { ExecutorContext } from '@nrwl/devkit';

import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { runWebpack } from '@nrwl/workspace/src/utilities/run-webpack';

import { map, tap } from 'rxjs/operators';
import { eachValueFrom } from 'rxjs-for-await';
import { join, resolve } from 'path';

import { getNodeWebpackConfig } from '../../utils/node.config';
import { OUT_FILENAME } from '../../utils/config';
import { BuildNodeBuilderOptions } from '../../utils/types';
import { normalizeBuildOptions } from '../../utils/normalize';
import { generatePackageJson } from '../../utils/generate-package-json';

try {
  require('dotenv').config();
} catch (e) {}

export type NodeBuildEvent = {
  outfile: string;
  success: boolean;
};

export function buildExecutor(
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
  const projGraph = createProjectGraph();
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
    generatePackageJson(context.projectName, projGraph, options);
  }
  let config = getNodeWebpackConfig(options);
  if (options.webpackConfig) {
    config = require(options.webpackConfig)(config, {
      options,
      configuration: context.configurationName,
    });
  }

  return eachValueFrom(
    runWebpack(config).pipe(
      tap((stats) => {
        console.info(stats.toString(config.stats));
      }),
      map((stats) => {
        return {
          success: !stats.hasErrors(),
          outfile: resolve(context.root, options.outputPath, OUT_FILENAME),
        } as NodeBuildEvent;
      })
    )
  );
}

export default buildExecutor;
