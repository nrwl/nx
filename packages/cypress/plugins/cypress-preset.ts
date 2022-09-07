import {
  ExecutorContext,
  ProjectConfiguration,
  ProjectGraph,
  readNxJson,
  stripIndents,
  TargetConfiguration,
  workspaceRoot,
} from '@nrwl/devkit';
import { mapProjectGraphFiles } from '@nrwl/workspace/src/utils/runtime-lint-utils';
import { readProjectsConfigurationFromProjectGraph } from 'nx/src/project-graph/project-graph';
import { dirname, extname, join, relative } from 'path';
import { lstatSync } from 'fs';

interface BaseCypressPreset {
  videosFolder: string;
  screenshotsFolder: string;
  video: boolean;
  chromeWebSecurity: boolean;
}

export interface NxComponentTestingOptions {
  /**
   * the component testing target name.
   * this is only when customized away from the default value of `component-test`
   * @example 'component-test'
   */
  ctTargetName: string;
}
export function nxBaseCypressPreset(pathToConfig: string): BaseCypressPreset {
  // prevent from placing path outside the root of the workspace
  // if they pass in a file or directory
  const normalizedPath = lstatSync(pathToConfig).isDirectory()
    ? pathToConfig
    : dirname(pathToConfig);
  const projectPath = relative(workspaceRoot, normalizedPath);
  const offset = relative(normalizedPath, workspaceRoot);
  const videosFolder = join(offset, 'dist', 'cypress', projectPath, 'videos');
  const screenshotsFolder = join(
    offset,
    'dist',
    'cypress',
    projectPath,
    'screenshots'
  );

  return {
    videosFolder,
    screenshotsFolder,
    video: true,
    chromeWebSecurity: false,
  };
}

/**
 * nx E2E Preset for Cypress
 * @description
 * this preset contains the base configuration
 * for your e2e tests that nx recommends.
 * you can easily extend this within your cypress config via spreading the preset
 * @example
 * export default defineConfig({
 *   e2e: {
 *     ...nxE2EPreset(__dirname)
 *     // add your own config here
 *   }
 * })
 *
 * @param pathToConfig will be used to construct the output paths for videos and screenshots
 */
export function nxE2EPreset(pathToConfig: string) {
  return {
    ...nxBaseCypressPreset(pathToConfig),
    fileServerFolder: '.',
    supportFile: 'src/support/e2e.ts',
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    fixturesFolder: 'src/fixtures',
  };
}

export function getProjectConfigByPath(
  graph: ProjectGraph,
  configPath: string
): ProjectConfiguration {
  const configFileFromWorkspaceRoot = relative(workspaceRoot, configPath);
  const normalizedPathFromWorkspaceRoot = lstatSync(configPath).isFile()
    ? configFileFromWorkspaceRoot.replace(extname(configPath), '')
    : configFileFromWorkspaceRoot;

  const mappedGraph = mapProjectGraphFiles(graph);
  const componentTestingProjectName =
    mappedGraph.allFiles[normalizedPathFromWorkspaceRoot];
  if (
    !componentTestingProjectName ||
    !graph.nodes[componentTestingProjectName]?.data
  ) {
    throw new Error(
      stripIndents`Unable to find the project configuration that includes ${normalizedPathFromWorkspaceRoot}. 
      Found project name? ${componentTestingProjectName}. 
      Graph has data? ${!!graph.nodes[componentTestingProjectName]?.data}`
    );
  }
  // make sure name is set since it can be undefined
  graph.nodes[componentTestingProjectName].data.name ??=
    componentTestingProjectName;
  return graph.nodes[componentTestingProjectName].data;
}

export function createExecutorContext(
  graph: ProjectGraph,
  targets: Record<string, TargetConfiguration>,
  projectName: string,
  targetName: string,
  configurationName: string
): ExecutorContext {
  const projectConfigs = readProjectsConfigurationFromProjectGraph(graph);
  return {
    cwd: process.cwd(),
    projectGraph: graph,
    target: targets[targetName],
    targetName,
    configurationName,
    root: workspaceRoot,
    isVerbose: false,
    projectName,
    workspace: {
      ...readNxJson(),
      ...projectConfigs,
    },
  };
}
