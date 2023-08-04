import { dirname, join } from 'path';
import { workspaceRoot } from '../utils/workspace-root';
import { readJsonFile } from '../utils/fileutils';
import { loadNxPlugins, loadNxPluginsSync } from '../utils/nx-plugin';

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

export class Workspaces {
  private cachedProjectsConfig: ProjectsConfigurations;

  constructor(private root: string) {}

  /**
   * @deprecated
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
        loadNxPluginsSync(),
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
      projects: this.mergeTargetDefaultsIntoProjectDescriptions(
        projectsConfigurations,
        nxJson
      ),
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
