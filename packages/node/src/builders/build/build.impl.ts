import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { JsonObject, workspaces } from '@angular-devkit/core';
import { runWebpack, BuildResult } from '@angular-devkit/build-webpack';
import { Observable, from } from 'rxjs';
import { join, resolve } from 'path';
import { map, concatMap } from 'rxjs/operators';
import { getNodeWebpackConfig } from '../../utils/node.config';
import { OUT_FILENAME } from '../../utils/config';
import { BuildBuilderOptions } from '../../utils/types';
import {
  normalizeBuildOptions,
  normalizeFileReplacements,
} from '../../utils/normalize';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import {
  createProjectGraph,
  ProjectGraph,
} from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utils/buildable-libs-utils';

try {
  require('dotenv').config();
} catch (e) {}

export interface BuildNodeBuilderOptions extends BuildBuilderOptions {
  optimization?: boolean;
  sourceMap?: boolean;
  externalDependencies: 'all' | 'none' | string[];
  buildLibsFromSource?: boolean;
}

export type NodeBuildEvent = BuildResult & {
  outfile: string;
};

export default createBuilder<JsonObject & BuildNodeBuilderOptions>(run);

function run(
  options: JsonObject & BuildNodeBuilderOptions,
  context: BuilderContext
): Observable<NodeBuildEvent> {
  const { configuration } = context.target;

  if (options.useGlobalFileReplacements) {
    const projGraph = createProjectGraph();
    const fileReplacements = resolveAllProjectFileReplacements(
      projGraph,
      configuration
    );
    options.fileReplacements = normalizeFileReplacements(
      context.workspaceRoot,
      fileReplacements
    );
  }

  if (!options.buildLibsFromSource) {
    const projGraph = createProjectGraph();
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
  }

  return from(getSourceRoot(context)).pipe(
    map((sourceRoot) =>
      normalizeBuildOptions(options, context.workspaceRoot, sourceRoot)
    ),
    map((options) => {
      let config = getNodeWebpackConfig(options);
      if (options.webpackConfig) {
        config = require(options.webpackConfig)(config, {
          options,
          configuration,
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

async function getSourceRoot(context: BuilderContext) {
  const workspaceHost = workspaces.createWorkspaceHost(new NodeJsSyncHost());
  const { workspace } = await workspaces.readWorkspace(
    context.workspaceRoot,
    workspaceHost
  );
  if (workspace.projects.get(context.target.project).sourceRoot) {
    return workspace.projects.get(context.target.project).sourceRoot;
  } else {
    context.reportStatus('Error');
    const message = `${context.target.project} does not have a sourceRoot. Please define one.`;
    context.logger.error(message);
    throw new Error(message);
  }
}

export function resolveAllProjectFileReplacements(
  projGraph: ProjectGraph,
  configuration: string
) {
  const projects = Object.values(projGraph.nodes);
  const fileReplacements = projects.reduce((allReplacements, project) => {
    const projectReplacements =
      project?.data?.architect?.build?.configurations?.[configuration]
        ?.fileReplacements;
    if (projectReplacements) {
      allReplacements.push(...projectReplacements);
    }
    return allReplacements;
  }, []);

  return fileReplacements;
}
