import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import {
  joinPathFragments,
  readNxJson,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { basename } from 'path';
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

  protected convertAsset(asset: string | any): string | any {
    if (typeof asset === 'string') {
      return this.convertSourceRootPath(asset);
    } else {
      return { ...asset, input: this.convertSourceRootPath(asset.input) };
    }
  }

  protected convertRootPath(originalPath: string): string {
    return originalPath?.startsWith(this.project.oldRoot)
      ? joinPathFragments(
          this.project.newRoot,
          originalPath.replace(this.project.oldRoot, '')
        )
      : originalPath;
  }

  protected moveFile(from: string, to: string, required: boolean = true): void {
    if (!this.tree.exists(from)) {
      if (required) {
        this.logger.warn(`The path "${from}" does not exist. Skipping.`);
      }
    } else if (this.tree.exists(to)) {
      if (required) {
        this.logger.warn(`The path "${to}" already exists. Skipping.`);
      }
    } else {
      const contents = this.tree.read(from);
      this.tree.write(to, contents);
      this.tree.delete(from);
    }
  }

  protected moveFilePathsFromTargetToProjectRoot(
    target: TargetConfiguration,
    options: string[]
  ) {
    options.forEach((option) => {
      this.getTargetValuesForOption(target, option).forEach((path) => {
        this.moveProjectRootFile(path);
      });
    });
  }

  protected moveProjectRootFile(filePath: string, isRequired = true): void {
    if (!filePath) {
      return;
    }

    const filename = !!filePath ? basename(filePath) : '';
    const from = filePath;
    const to = joinPathFragments(this.project.newRoot, filename);
    this.moveFile(from, to, isRequired);
  }

  // TODO(leo): This should be moved to BuilderMigrator once everything is split into builder migrators.
  protected updateCacheableOperations(targetNames: string[]): void {
    if (!targetNames.length) {
      return;
    }

    const nxJson = readNxJson(this.tree);

    Object.keys(nxJson.tasksRunnerOptions ?? {}).forEach((taskRunnerName) => {
      const taskRunner = nxJson.tasksRunnerOptions[taskRunnerName];
      taskRunner.options.cacheableOperations = Array.from(
        new Set([
          ...(taskRunner.options.cacheableOperations ?? []),
          ...targetNames,
        ])
      );
    });

    updateNxJson(this.tree, nxJson);
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

  private convertSourceRootPath(originalPath: string): string {
    return originalPath?.startsWith(this.project.oldSourceRoot)
      ? joinPathFragments(
          this.project.newSourceRoot,
          originalPath.replace(this.project.oldSourceRoot, '')
        )
      : originalPath;
  }

  private getTargetValuesForOption(
    target: TargetConfiguration,
    optionPath: string
  ): any[] {
    const values = new Set();
    const value = this.getValueForOption(target.options, optionPath);
    if (value) {
      values.add(value);
    }

    for (const configuration of Object.values(target.configurations ?? {})) {
      const value = this.getValueForOption(configuration, optionPath);
      if (value) {
        values.add(value);
      }
    }

    return Array.from(values);
  }

  private getValueForOption(
    options: Record<string, any> | undefined,
    optionPath: string
  ): any {
    if (!options) {
      return null;
    }

    const segments = optionPath.split('.');
    let value = options;
    for (const segment of segments) {
      if (value && value[segment]) {
        value = value[segment];
      } else {
        return null;
      }
    }

    return value;
  }
}
