import { dirname } from 'path';

import type { NxJsonConfiguration } from './nx-json';
import { readNxJson } from './nx-json';
import { ProjectsConfigurations } from './workspace-json-project-json';
import { retrieveProjectConfigurationsSync } from '../project-graph/utils/retrieve-workspace-files.deprecated';

// TODO(v18): remove this class
/**
 * @deprecated This will be removed in v18. Use {@link readProjectsConfigurationFromProjectGraph} instead.
 */
export class Workspaces {
  constructor(private root: string) {}

  /**
   * @deprecated Use {@link readProjectsConfigurationFromProjectGraph} instead.
   */
  readWorkspaceConfiguration(): ProjectsConfigurations & NxJsonConfiguration {
    const nxJson = readNxJson(this.root);

    return {
      version: 2,
      projects: retrieveProjectConfigurationsSync(this.root, nxJson)
        .projectNodes,
      ...nxJson,
    };
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
