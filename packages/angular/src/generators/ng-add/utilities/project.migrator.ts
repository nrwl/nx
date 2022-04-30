import {
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  readWorkspaceConfiguration,
  TargetConfiguration,
  Tree,
  updateJson,
  updateWorkspaceConfiguration,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { basename, dirname } from 'path';
import { GeneratorOptions } from '../schema';
import { Logger } from './logger';
import {
  MigrationProjectConfiguration,
  Target,
  ValidationResult,
} from './types';
import { arrayToString } from './validation-logging';

export abstract class ProjectMigrator<TargetType extends string = any> {
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
  protected readonly targetNames: Partial<Record<TargetType, string>> = {};

  constructor(
    protected readonly tree: Tree,
    protected readonly options: GeneratorOptions,
    protected readonly targets: Record<TargetType, Target>,
    project: MigrationProjectConfiguration,
    rootDir: string,
    logger?: Logger
  ) {
    this.projectConfig = project.config;
    this.project = {
      name: project.name,
      oldRoot: this.projectConfig.root ?? '',
      oldSourceRoot:
        this.projectConfig.sourceRoot ||
        joinPathFragments(this.projectConfig.root ?? '', 'src'),
      newRoot: `${rootDir}/${project.name}`,
      newSourceRoot: `${rootDir}/${project.name}/src`,
    };

    this.logger = logger ?? new Logger(this.project.name);

    this.collectTargetNames();
  }

  abstract migrate(): Promise<void>;

  validate(): ValidationResult {
    const result: ValidationResult = [];

    // check project root
    if (
      this.projectConfig.root === undefined ||
      this.projectConfig.root === null
    ) {
      result.push({
        message:
          'The project root is not defined in the project configuration.',
        hint:
          `Make sure the value for "projects.${this.project.name}.root" is set ` +
          `or remove the project if it is not valid.`,
      });
    } else if (
      this.projectConfig.root !== '' &&
      !this.tree.exists(this.projectConfig.root)
    ) {
      result.push({
        message: `The project root "${this.project.oldRoot}" could not be found.`,
        hint:
          `Make sure the value for "projects.${this.project.name}.root" is correct ` +
          `or remove the project if it is not valid.`,
      });
    }

    // check project source root
    if (
      this.projectConfig.sourceRoot &&
      !this.tree.exists(this.projectConfig.sourceRoot)
    ) {
      result.push({
        message: `The project source root "${this.project.oldSourceRoot}" could not be found.`,
        hint:
          `Make sure the value for "projects.${this.project.name}.sourceRoot" is correct ` +
          `or remove the project if it is not valid.`,
      });
    }

    // check for usage of unsupported builders
    const allSupportedBuilders = [
      ...Object.values<Target>(this.targets)
        .map((x) => x.builders)
        .flat(),
    ];
    const unsupportedBuilders: [target: string, builder: string][] = [];

    Object.entries(this.projectConfig.targets ?? {}).forEach(
      ([targetName, target]) => {
        if (!allSupportedBuilders.includes(target.executor)) {
          unsupportedBuilders.push([targetName, target.executor]);
        }
      }
    );

    if (unsupportedBuilders.length) {
      result.push({
        messageGroup: {
          title: 'Unsupported builders',
          messages: unsupportedBuilders.map(
            ([target, builder]) =>
              `The "${target}" target is using an unsupported builder "${builder}".`
          ),
        },
        hint: `The supported builders for ${
          this.projectConfig.projectType === 'library'
            ? 'libraries'
            : 'applications'
        } are: ${arrayToString(allSupportedBuilders)}.`,
      });
    }

    // check for multiple targets for the same type of target
    const targetTypes = Object.keys(this.targets) as TargetType[];
    const targetsByType: Record<TargetType, string[]> = Object.entries(
      this.projectConfig.targets ?? {}
    ).reduce(
      (acc, [target, { executor }]) => {
        targetTypes.forEach((targetType) => {
          if (this.targets[targetType].builders.includes(executor)) {
            acc[targetType].push(target);
            return acc;
          }
        });

        return acc;
      },
      targetTypes.reduce(
        (acc, targetType) => ({ ...acc, [targetType]: [] }),
        {} as Record<TargetType, string[]>
      )
    );
    targetTypes.forEach((targetType) => {
      if (
        this.targets[targetType].acceptMultipleDefinitions ||
        targetsByType[targetType].length <= 1
      ) {
        return;
      }

      result.push({
        message: `There is more than one target using a builder that is used to ${targetType} the project (${arrayToString(
          targetsByType[targetType]
        )}).`,
        hint: `Make sure the project only has one target with a builder that is used to ${targetType} the project.`,
      });
    });

    return result.length ? result : null;
  }

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

    if (originalPath?.startsWith(this.project.oldRoot)) {
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

    for (const configuration of Object.values(target.configurations ?? {})) {
      const value = this.getValueForOption(configuration, optionPath);
      if (value) {
        values.add(value);
      }
    }

    return Array.from(values);
  }

  protected getValueForOption(
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

  private collectTargetNames(): void {
    const targetTypes = Object.keys(this.targets) as TargetType[];

    Object.entries(this.projectConfig.targets ?? {}).forEach(
      ([targetName, target]) => {
        targetTypes.forEach((targetType) => {
          if (
            !this.targetNames[targetType] &&
            this.targets[targetType].builders.includes(target.executor)
          ) {
            this.targetNames[targetType] = targetName;
          }
        });
      }
    );
  }
}
