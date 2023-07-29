import {
  createExecutorContext,
  getProjectConfigByPath,
} from '@nx/cypress/src/utils/ct-helpers';
import {
  nxBaseCypressPreset,
  NxComponentTestingOptions,
} from '@nx/cypress/plugins/cypress-preset';
import {
  ExecutorContext,
  parseTargetString,
  readCachedProjectGraph,
  readTargetOptions,
  stripIndents,
} from '@nx/devkit';
import { withReact } from '@nx/react';
import {
  AssetGlobPattern,
  composePluginsSync,
  NormalizedWebpackExecutorOptions,
  withNx,
} from '@nx/webpack';
import { join } from 'path';
import { NextBuildBuilderOptions } from '../src/utils/types';
import { CypressExecutorOptions } from '@nx/cypress/src/executors/cypress/cypress.impl';

export function nxComponentTestingPreset(
  pathToConfig: string,
  options?: NxComponentTestingOptions
) {
  const graph = readCachedProjectGraph();
  const { targets: ctTargets, name: ctProjectName } = getProjectConfigByPath(
    graph,
    pathToConfig
  );
  const ctTargetName = options?.ctTargetName || 'component-test';
  const ctConfigurationName = process.env.NX_CYPRESS_TARGET_CONFIGURATION;
  const ctExecutorContext: ExecutorContext = createExecutorContext(
    graph,
    ctTargets,
    ctProjectName,
    ctTargetName,
    ctConfigurationName
  );
  const ctExecutorOptions = readTargetOptions<CypressExecutorOptions>(
    {
      project: ctProjectName,
      target: ctTargetName,
      configuration: ctConfigurationName,
    },
    ctExecutorContext
  );

  const buildTarget = ctExecutorOptions.devServerTarget;

  let buildAssets: AssetGlobPattern[] = [];
  let buildFileReplacements = [];
  let buildOuputPath = `dist/${ctProjectName}/.next`;
  if (buildTarget) {
    const parsedBuildTarget = parseTargetString(buildTarget, graph);
    const buildProjectConfig = graph.nodes[parsedBuildTarget.project]?.data;
    const buildExecutorContext = createExecutorContext(
      graph,
      buildProjectConfig.targets,
      parsedBuildTarget.project,
      parsedBuildTarget.target,
      parsedBuildTarget.configuration
    );
    const buildExecutorOptions = readTargetOptions<NextBuildBuilderOptions>(
      {
        project: parsedBuildTarget.project,
        target: parsedBuildTarget.target,
        configuration: parsedBuildTarget.configuration,
      },
      buildExecutorContext
    );

    buildAssets ??= buildExecutorOptions.assets;
    buildFileReplacements ??= buildExecutorOptions.fileReplacements;
    buildOuputPath ??= buildExecutorOptions.outputPath;
  }

  const ctProjectConfig = graph.nodes[ctProjectName]?.data;

  if (!ctProjectConfig) {
    throw new Error(stripIndents`Unable to load project configs from the project graph.
Provided build target, ${buildTarget}.
Able to find CT project, ${!!ctProjectConfig}.`);
  }

  const webpackOptions: NormalizedWebpackExecutorOptions = {
    root: ctExecutorContext.root,
    projectRoot: ctProjectConfig.root,
    sourceRoot: ctProjectConfig.sourceRoot,
    main: '',
    fileReplacements: buildFileReplacements,
    assets: buildAssets,
    outputPath: buildOuputPath,
    outputFileName: 'main.js',
    compiler: 'swc',
    tsConfig: join(
      ctExecutorContext.root,
      ctProjectConfig.root,
      'tsconfig.json'
    ),
  };
  const configure = composePluginsSync(
    withNx(),
    withReact({
      styles: [],
      scripts: [],
      postcssConfig: ctProjectConfig.root,
    })
  );
  const webpackConfig = configure(
    {},
    {
      options: webpackOptions,
      context: ctExecutorContext,
    }
  );

  return {
    ...nxBaseCypressPreset(__filename),
    specPattern: '**/*.cy.{js,jsx,ts,tsx}',
    devServer: {
      ...({ framework: 'react', bundler: 'webpack' } as const),
      webpackConfig,
    },
  };
}
