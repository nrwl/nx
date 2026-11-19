import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import {
  joinPathFragments,
  normalizePath,
  readNxJson,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { findTargetDefault, upsertTargetDefault } from '@nx/devkit/internal';
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
      return this.convertRootPath(asset);
    } else {
      return { ...asset, input: this.convertRootPath(asset.input) };
    }
  }

  protected convertRootPath(originalPath: string): string {
    return (
      replacePathPrefix(
        originalPath,
        this.project.oldRoot,
        this.project.newRoot
      ) ?? originalPath
    );
  }

  protected convertSourceRootPath(originalPath: string): string {
    return (
      replacePathPrefix(
        originalPath,
        this.project.oldSourceRoot,
        this.project.newSourceRoot
      ) ?? originalPath
    );
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

    const nxJson = readNxJson(this.tree) ?? {};
    for (const name of targetNames) {
      const existing = findTargetDefault(nxJson.targetDefaults, {
        target: name,
      });
      upsertTargetDefault(this.tree, nxJson, {
        target: name,
        cache: existing?.cache ?? true,
      });
    }
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

/**
 * Returns `undefined` when `path` isn't under `oldPrefix`. The prefix matches
 * whole path segments, and an empty prefix (a root project) matches any path.
 */
export function replacePathPrefix(
  path: string | undefined,
  oldPrefix: string,
  newPrefix: string
): string | undefined {
  if (typeof path !== 'string') {
    return undefined;
  }

  const normalizedPath = normalizePath(path).replace(/^\.\//, '');
  const normalizedPrefix = normalizePath(oldPrefix)
    .replace(/^\.\//, '')
    .replace(/\/+$/, '');
  if (
    normalizedPrefix === '' ||
    normalizedPath === normalizedPrefix ||
    normalizedPath.startsWith(`${normalizedPrefix}/`)
  ) {
    return joinPathFragments(
      newPrefix,
      normalizedPath.slice(normalizedPrefix.length)
    );
  }

  return undefined;
}
