import { dirname } from 'path';
import { getNxRequirePaths } from '../utils/installation-directory';
import { loadNxPluginsSync } from '../utils/nx-plugin';

import type { NxJsonConfiguration } from './nx-json';
import { readNxJson } from './nx-json';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from './workspace-json-project-json';
import {
  mergeAngularJsonAndProjects,
  shouldMergeAngularProjects,
} from '../adapter/angular-json';
import { retrieveProjectConfigurationPaths } from '../project-graph/utils/retrieve-workspace-files';
import {
  buildProjectsConfigurationsFromProjectPathsAndPlugins,
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
} from '../project-graph/utils/project-configuration-utils';

// TODO(v18): remove this class
/**
 * @deprecated These will be removed in v18.
 * - For Workspaces.readWorkspaceConfiguration, use retrieveProjectConfigurations/retrieveProjectConfigurationsWithAngularProjects instead.
 */
export class Workspaces {
  private cachedProjectsConfig: ProjectsConfigurations;

  constructor(private root: string) {}

  /**
   * @deprecated se retrieveProjectConfigurations/retrieveProjectConfigurationsWithAngularProjects instead
   */
  readProjectsConfigurations(opts?: {
    _includeProjectsFromAngularJson?: boolean;
  }): ProjectsConfigurations {
    if (
      this.cachedProjectsConfig &&
      process.env.NX_CACHE_PROJECTS_CONFIG !== 'false'
    ) {
      return this.cachedProjectsConfig;
    }
    const nxJson = readNxJson(this.root);
    const projectPaths = retrieveProjectConfigurationPaths(this.root, nxJson);
    let projectsConfigurations =
      buildProjectsConfigurationsFromProjectPathsAndPlugins(
        nxJson,
        projectPaths,
        loadNxPluginsSync(
          nxJson.plugins,
          getNxRequirePaths(this.root),
          this.root
        ),
        this.root
      ).projects;
    if (
      shouldMergeAngularProjects(
        this.root,
        opts?._includeProjectsFromAngularJson
      )
    ) {
      projectsConfigurations = mergeAngularJsonAndProjects(
        projectsConfigurations,
        this.root
      );
    }
    this.cachedProjectsConfig = {
      version: 2,
      projects: projectsConfigurations,
    };
    return this.cachedProjectsConfig;
  }

  /**
   * Deprecated. Use readProjectsConfigurations
   */
  readWorkspaceConfiguration(opts?: {
    _ignorePluginInference?: boolean;
    _includeProjectsFromAngularJson?: boolean;
  }): ProjectsConfigurations & NxJsonConfiguration {
    const nxJson = readNxJson(this.root);
    return { ...this.readProjectsConfigurations(opts), ...nxJson };
  }

  private mergeTargetDefaultsIntoProjectDescriptions(
    projects: Record<string, ProjectConfiguration>,
    nxJson: NxJsonConfiguration
  ) {
    for (const proj of Object.values(projects)) {
      if (proj.targets) {
        for (const targetName of Object.keys(proj.targets ?? {})) {
          const projectTargetDefinition = proj.targets[targetName];
          const defaults = readTargetDefaultsForTarget(
            targetName,
            nxJson.targetDefaults,
            projectTargetDefinition.executor
          );

          if (defaults) {
            proj.targets[targetName] = mergeTargetConfigurations(
              proj,
              targetName,
              defaults
            );
          }
        }
      }
    }
    return projects;
  }
}

/**
 * Pulled from toFileName in names from @nx/devkit.
 * Todo: Should refactor, not duplicate.
 */
export function toProjectName(fileName: string): string {
  const parts = dirname(fileName).split(/[\/\\]/g);
  return parts[parts.length - 1].toLowerCase();
}
