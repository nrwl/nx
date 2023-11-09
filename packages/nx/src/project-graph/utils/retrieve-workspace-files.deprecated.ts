import { globWithWorkspaceContext } from '../../utils/workspace-context';
import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraphExternalNode } from '../../config/project-graph';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { getNxRequirePaths } from '../../utils/installation-directory';
import { loadNxPluginsSync } from '../../utils/nx-plugin';
import { buildProjectsConfigurationsFromProjectPathsAndPlugins } from './project-configuration-utils';
import { configurationGlobs } from './retrieve-workspace-files';

/**
 * @deprecated Use {@link retrieveProjectConfigurations} instead.
 */
export function retrieveProjectConfigurationsSync(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration
): {
  externalNodes: Record<string, ProjectGraphExternalNode>;
  projectNodes: Record<string, ProjectConfiguration>;
} {
  const plugins = loadNxPluginsSync(
    nxJson?.plugins ?? [],
    getNxRequirePaths(workspaceRoot),
    workspaceRoot
  );

  const globs = configurationGlobs(workspaceRoot, plugins);
  const files = globWithWorkspaceContext(workspaceRoot, globs);

  const res = buildProjectsConfigurationsFromProjectPathsAndPlugins(
    nxJson,
    files,
    plugins,
    workspaceRoot,
    true
  );

  return {
    externalNodes: res.externalNodes,
    projectNodes: res.projects,
  };
}
