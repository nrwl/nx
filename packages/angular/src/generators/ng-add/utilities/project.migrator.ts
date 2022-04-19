import {
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateJson,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { basename, dirname } from 'path';
import { GeneratorOptions } from '../schema';
import { Logger } from './logger';
import { MigrationProjectConfiguration, ValidationResult } from './types';

export abstract class ProjectMigrator {
  public get projectName(): string {
    return this.project.name;
  }

  protected projectConfig: ProjectConfiguration;
  protected project: {
    name: string;
    oldRoot: string;
    oldSourceRoot: string;
    newRoot: string;
    newSourceRoot: string;
  };
  protected logger: Logger;

  constructor(
    protected readonly tree: Tree,
    protected readonly options: GeneratorOptions,
    project: MigrationProjectConfiguration,
    rootDir: string,
    logger?: Logger
  ) {
    this.projectConfig = project.config;
    this.project = {
      name: project.name,
      oldRoot: this.projectConfig.root ?? '',
      oldSourceRoot:
        this.projectConfig.sourceRoot ?? this.projectConfig.root ?? '',
      newRoot: `${rootDir}/${project.name}`,
      newSourceRoot: `${rootDir}/${project.name}/src`,
    };

    this.logger = logger ?? new Logger(this.project.name);
  }

  abstract migrate(): Promise<void>;
  abstract validate(): ValidationResult;

  protected convertAsset(asset: string | any): string | any {
    if (typeof asset === 'string') {
      return this.convertSourceRootPath(asset);
    } else {
      return { ...asset, input: this.convertSourceRootPath(asset.input) };
    }
  }

  protected convertEsLintConfigExtendToNewPath(
    eslintConfigPath: string,
    extendPath: string
  ): string {
    if (!extendPath.startsWith('..')) {
      // we only need to adjust paths that are on a different directory, files
      // in the same directory are moved together so their relative paths are
      // not changed
      return extendPath;
    }

    return joinPathFragments(
      offsetFromRoot(this.project.newRoot),
      dirname(eslintConfigPath),
      extendPath
    );
  }

  protected convertSourceRootPath(originalPath: string): string {
    return originalPath?.startsWith(this.project.oldSourceRoot)
      ? joinPathFragments(
          this.project.newSourceRoot,
          originalPath.replace(this.project.oldSourceRoot, '')
        )
      : originalPath;
  }

  protected convertRootPath(originalPath: string): string {
    return originalPath?.startsWith(this.project.oldRoot)
      ? joinPathFragments(
          this.project.newRoot,
          originalPath.replace(this.project.oldRoot, '')
        )
      : originalPath;
  }

  protected convertPath(originalPath: string): string {
    if (originalPath?.startsWith(this.project.oldSourceRoot)) {
      return joinPathFragments(
        this.project.newSourceRoot,
        originalPath.replace(this.project.oldSourceRoot, '')
      );
    }

    if (
      this.project.oldRoot !== '' &&
      originalPath?.startsWith(this.project.oldRoot)
    ) {
      return joinPathFragments(
        this.project.newRoot,
        originalPath.replace(this.project.oldRoot, '')
      );
    }

    return originalPath;
  }

  protected getTargetValuesForOption(
    target: TargetConfiguration,
    optionPath: string
  ): any[] {
    const values = new Set();
    const value = this.getValueForOption(target.options, optionPath);
    if (value) {
      values.add(value);
    }

    if (target.configurations) {
      for (const configuration of Object.values(target.configurations)) {
        const value = this.getValueForOption(configuration, optionPath);
        if (value) {
          values.add(value);
        }
      }
    }

    return Array.from(values);
  }

  protected getValueForOption(
    options: Record<string, any>,
    optionPath: string
  ): any {
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

  protected moveProjectRootFile(filePath: string, isRequired = true): void {
    if (!filePath) {
      return;
    }

    const filename = !!filePath ? basename(filePath) : '';
    const from = filePath;
    const to = joinPathFragments(this.project.newRoot, filename);
    this.moveFile(from, to, isRequired);
  }

  protected moveDir(from: string, to: string): void {
    visitNotIgnoredFiles(this.tree, from, (file) => {
      this.moveFile(file, file.replace(from, to), true);
    });
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
