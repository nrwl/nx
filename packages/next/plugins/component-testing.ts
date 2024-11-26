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
  readProjectsConfigurationFromProjectGraph,
  readTargetOptions,
  stripIndents,
  workspaceRoot,
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
import { readNxJson } from 'nx/src/config/configuration';

export function nxComponentTestingPreset(
  pathToConfig: string,
  options?: NxComponentTestingOptions
) {
  if (global.NX_GRAPH_CREATION) {
    // this is only used by plugins, so we don't need the component testing
    // options, cast to any to avoid type errors
    return nxBaseCypressPreset(pathToConfig) as any;
  }

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

  let buildTarget: string = options?.buildTarget;
  if (!buildTarget) {
    const ctExecutorOptions = readTargetOptions<CypressExecutorOptions>(
      {
        project: ctProjectName,
        target: ctTargetName,
        configuration: ctConfigurationName,
      },
      ctExecutorContext
    );

    buildTarget = ctExecutorOptions.devServerTarget;
  }

  let buildAssets: AssetGlobPattern[] = [];
  let buildFileReplacements = [];
  let buildOuputPath = `dist/${ctProjectName}/.next`;
  if (buildTarget) {
    const parsedBuildTarget = parseTargetString(buildTarget, {
      cwd: process.cwd(),
      root: workspaceRoot,
      projectsConfigurations: readProjectsConfigurationFromProjectGraph(graph),
      nxJsonConfiguration: readNxJson(workspaceRoot),
      isVerbose: false,
      projectName: ctProjectName,
      projectGraph: graph,
    });
    const buildProjectConfig = graph.nodes[parsedBuildTarget.project]?.data;

    if (
      buildProjectConfig?.targets?.[parsedBuildTarget.target]?.executor !==
      '@nx/next:build'
    ) {
      throw new Error(
        `The '${parsedBuildTarget.target}' target of the '${[
          parsedBuildTarget.project,
        ]}' project is not using the '@nx/next:build' executor. ` +
          `Please make sure to use '@nx/next:build' executor in that target to use Cypress Component Testing.`
      );
    }

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
    compiler: options?.compiler || 'swc',
    tsConfig: join(
      ctExecutorContext.root,
      ctProjectConfig.root,
      'tsconfig.json'
    ),
  };
  const configure = composePluginsSync(
    withNx({
      target: 'web',
      styles: [],
      scripts: [],
      postcssConfig: ctProjectConfig.root,
    }),
    withReact({})
  );
  const webpackConfig = configure(
    {},
    {
      options: webpackOptions,
      context: ctExecutorContext,
    }
  );

  return {
    ...nxBaseCypressPreset(pathToConfig),
    specPattern: '**/*.cy.{js,jsx,ts,tsx}',
    devServer: {
      ...({ framework: 'react', bundler: 'webpack' } as const),
      webpackConfig,
    },
  };
}
