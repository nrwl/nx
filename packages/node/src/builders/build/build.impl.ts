import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { JsonObject, normalize, workspaces } from '@angular-devkit/core';
import { BuildResult, runWebpack } from '@angular-devkit/build-webpack';

import { from, Observable } from 'rxjs';
import { join, resolve } from 'path';
import { concatMap, map, tap } from 'rxjs/operators';
import { getNodeWebpackConfig } from '../../utils/node.config';
import { OUT_FILENAME } from '../../utils/config';
import { BuildNodeBuilderOptions } from '../../utils/types';
import { normalizeBuildOptions } from '../../utils/normalize';
import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utils/buildable-libs-utils';
import { NxScopedHost } from '@nrwl/devkit/ngcli-adapter';
import { generatePackageJson } from '../../utils/generate-package-json';

try {
  require('dotenv').config();
} catch (e) {}

export type NodeBuildEvent = BuildResult & {
  outfile: string;
};

export default createBuilder<JsonObject & BuildNodeBuilderOptions>(run);

function run(
  options: JsonObject & BuildNodeBuilderOptions,
  context: BuilderContext
): Observable<NodeBuildEvent> {
  const projGraph = createProjectGraph();
  if (!options.buildLibsFromSource) {
    const { target, dependencies } = calculateProjectDependencies(
      projGraph,
      context
    );
    options.tsConfig = createTmpTsConfig(
      join(context.workspaceRoot, options.tsConfig),
      context.workspaceRoot,
      target.data.root,
      dependencies
    );

    if (!checkDependentProjectsHaveBeenBuilt(context, dependencies)) {
      return { success: false } as any;
    }
  }

  return from(getRoots(context)).pipe(
    map(({ sourceRoot, projectRoot }) =>
      normalizeBuildOptions(
        options,
        context.workspaceRoot,
        sourceRoot,
        projectRoot
      )
    ),
    tap((normalizedOptions) => {
      if (normalizedOptions.generatePackageJson) {
        generatePackageJson(
          context.target.project,
          projGraph,
          normalizedOptions
        );
      }
    }),
    map((options) => {
      let config = getNodeWebpackConfig(options);
      if (options.webpackConfig) {
        config = require(options.webpackConfig)(config, {
          options,
          configuration: context.target.configuration,
        });
      }
      return config;
    }),
    concatMap((config) =>
      runWebpack(config, context, {
        logging: (stats) => {
          context.logger.info(stats.toString(config.stats));
        },
        webpackFactory: require('webpack'),
      })
    ),
    map((buildEvent: BuildResult) => {
      buildEvent.outfile = resolve(
        context.workspaceRoot,
        options.outputPath,
        OUT_FILENAME
      );
      return buildEvent as NodeBuildEvent;
    })
  );
}

async function getRoots(
  context: BuilderContext
): Promise<{ sourceRoot: string; projectRoot: string }> {
  const workspaceHost = workspaces.createWorkspaceHost(
    new NxScopedHost(normalize(context.workspaceRoot))
  );
  const { workspace } = await workspaces.readWorkspace('', workspaceHost);
  const project = workspace.projects.get(context.target.project);
  if (project.sourceRoot && project.root) {
    return { sourceRoot: project.sourceRoot, projectRoot: project.root };
  } else {
    context.reportStatus('Error');
    const message = `${context.target.project} does not have a sourceRoot or root. Please define one.`;
    context.logger.error(message);
    throw new Error(message);
  }
}
