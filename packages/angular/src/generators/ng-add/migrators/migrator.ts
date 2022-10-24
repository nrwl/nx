import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import {
  readWorkspaceConfiguration,
  updateJson,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import type { Logger } from '../utilities/logger';
import type {
  ProjectMigrationInfo,
  ValidationResult,
} from '../utilities/types';

export abstract class Migrator {
  protected project: ProjectMigrationInfo;
  protected readonly originalProjectConfig: ProjectConfiguration;

  constructor(
    protected readonly tree: Tree,
    protected projectConfig: ProjectConfiguration,
    protected readonly logger: Logger
  ) {
    this.originalProjectConfig = Object.freeze(
      JSON.parse(JSON.stringify(this.projectConfig))
    );
  }

  abstract migrate(): Promise<void> | void;
  abstract validate(): ValidationResult;

  // TODO(leo): This should be moved to BuilderMigrator once everything is split into builder migrators.
  protected updateCacheableOperations(targetNames: string[]): void {
    if (!targetNames.length) {
      return;
    }

    const workspaceConfig = readWorkspaceConfiguration(this.tree);

    Object.keys(workspaceConfig.tasksRunnerOptions ?? {}).forEach(
      (taskRunnerName) => {
        const taskRunner = workspaceConfig.tasksRunnerOptions[taskRunnerName];
        taskRunner.options.cacheableOperations = Array.from(
          new Set([
            ...(taskRunner.options.cacheableOperations ?? []),
            ...targetNames,
          ])
        );
      }
    );

    updateWorkspaceConfiguration(this.tree, workspaceConfig);
  }

  // TODO(leo): This should be moved to BuilderMigrator once everything is split into builder migrators.
  protected updateTsConfigFile(
    tsConfigPath: string,
    rootTsConfigFile: string,
    projectOffsetFromRoot: string
  ): void {
    updateJson(this.tree, tsConfigPath, (json) => {
      json.extends = `${projectOffsetFromRoot}${rootTsConfigFile}`;
      json.compilerOptions = json.compilerOptions ?? {};
      json.compilerOptions.outDir = `${projectOffsetFromRoot}dist/out-tsc`;
      return json;
    });
  }
}
