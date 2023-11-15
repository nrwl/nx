import { getNxPackageJsonWorkspacesPlugin } from '../../plugins/package-json-workspaces';
import {
  NxAngularJsonPlugin,
  shouldMergeAngularProjects,
} from '../adapter/angular-json';
import { NxJsonConfiguration, PluginConfiguration } from '../config/nx-json';
import { ProjectGraphProcessor } from '../config/project-graph';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../config/workspace-json-project-json';
import { CreateProjectJsonProjectsPlugin } from '../plugins/project-json/build-nodes/project-json';
import { retrieveProjectConfigurationsWithoutPluginInference } from '../project-graph/utils/retrieve-workspace-files';
import { getNxRequirePaths } from './installation-directory';
import {
  ensurePluginIsV2,
  getPluginPathAndName,
  LoadedNxPlugin,
  nxPluginCache,
  NxPluginV2,
} from './nx-plugin';
import { workspaceRoot } from './workspace-root';

/**
 * @deprecated Add targets to the projects in a {@link CreateNodes} function instead. This will be removed in Nx 18
 */
export type ProjectTargetConfigurator = (
  file: string
) => Record<string, TargetConfiguration>;

/**
 * @deprecated Use {@link NxPluginV2} instead. This will be removed in Nx 18
 */
export type NxPluginV1 = {
  name: string;
  /**
   * @deprecated Use {@link CreateNodes} and {@link CreateDependencies} instead. This will be removed in Nx 18
   */
  processProjectGraph?: ProjectGraphProcessor;

  /**
   * @deprecated Add targets to the projects inside of {@link CreateNodes} instead. This will be removed in Nx 18
   */
  registerProjectTargets?: ProjectTargetConfigurator;

  /**
   * A glob pattern to search for non-standard project files.
   * @example: ["*.csproj", "pom.xml"]
   * @deprecated Use {@link CreateNodes} instead. This will be removed in Nx 18
   */
  projectFilePatterns?: string[];
};

/**
 * @todo(@agentender) v18: Remove this fn when we remove readWorkspaceConfig
 */
export function getDefaultPluginsSync(root: string): LoadedNxPlugin[] {
  const plugins: NxPluginV2[] = [require('../plugins/js')];

  if (shouldMergeAngularProjects(root, false)) {
    plugins.push(require('../adapter/angular-json').NxAngularJsonPlugin);
  }
  return plugins.map((p) => ({
    plugin: p,
  }));
}
