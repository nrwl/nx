import {
  joinPathFragments,
  offsetFromRoot,
  readJson,
  readWorkspaceConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  updateWorkspaceConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { hasRulesRequiringTypeChecking } from '@nrwl/linter';
import { convertToNxProjectGenerator } from '@nrwl/workspace/generators';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { basename } from 'path';
import { addBuildableLibrariesPostCssDependencies } from '../../utils/dependencies';
import { GeneratorOptions } from '../schema';
import { Logger } from './logger';
import { ProjectMigrator } from './project.migrator';
import { MigrationProjectConfiguration, ValidationResult } from './types';
import { arrayToString } from './validation-logging';

export class LibMigrator extends ProjectMigrator {
  private readonly supportedBuilders = {
    build: '@angular-devkit/build-angular:ng-packagr',
    test: '@angular-devkit/build-angular:karma',
    lint: '@angular-eslint/builder:lint',
  };
  private readonly targetNames: {
    build?: string;
    lint?: string;
    test?: string;
  } = {};
  private oldEsLintConfigPath: string;
  private newEsLintConfigPath: string;

  constructor(
    tree: Tree,
    options: GeneratorOptions,
    project: MigrationProjectConfiguration,
    logger?: Logger
  ) {
    super(tree, options, project, 'libs', logger);

    this.collectTargetNames();

    if (this.targetNames.lint) {
      this.oldEsLintConfigPath =
        this.projectConfig.targets[this.targetNames.lint].options
          ?.eslintConfig ??
        joinPathFragments(this.project.oldRoot, '.eslintrc.json');
      this.newEsLintConfigPath = this.convertRootPath(this.oldEsLintConfigPath);
    }
  }

  async migrate(): Promise<void> {
    this.moveProjectFiles();
    await this.updateProjectConfiguration();
    this.updateNgPackageJson();
    this.updateTsConfigs();
    this.updateEsLintConfig();
    this.updateCacheableOperations();
    addBuildableLibrariesPostCssDependencies(this.tree);
  }

  validate(): ValidationResult {
    const result: ValidationResult = [];

    // check project root
    if (!this.tree.exists(this.projectConfig.root)) {
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
      this.supportedBuilders.build,
      this.supportedBuilders.test,
      this.supportedBuilders.lint,
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
        hint: `The supported builders for libraries are: ${arrayToString(
          allSupportedBuilders
        )}.`,
      });
    }

    // check for multiple targets for the same type of target
    const targetsByType: {
      [key in keyof Required<typeof this.targetNames>]: string[];
    } = Object.entries(this.projectConfig.targets ?? {}).reduce(
      (acc, [target, { executor }]) => {
        if (this.supportedBuilders.build === executor) {
          acc.build.push(target);
        } else if (this.supportedBuilders.test === executor) {
          acc.test.push(target);
        } else if (this.supportedBuilders.lint === executor) {
          acc.lint.push(target);
        }

        return acc;
      },
      { build: [], lint: [], test: [] }
    );
    ['build', 'lint', 'test'].forEach((targetType) => {
      if (targetsByType[targetType].length <= 1) {
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

  private collectTargetNames(): void {
    Object.entries(this.projectConfig.targets ?? {}).forEach(
      ([targetName, target]) => {
        if (
          !this.targetNames.build &&
          this.supportedBuilders.build === target.executor
        ) {
          this.targetNames.build = targetName;
        } else if (
          !this.targetNames.test &&
          this.supportedBuilders.test === target.executor
        ) {
          this.targetNames.test = targetName;
        } else if (
          !this.targetNames.lint &&
          this.supportedBuilders.lint === target.executor
        ) {
          this.targetNames.lint = targetName;
        }
      }
    );
  }

  private moveProjectFiles(): void {
    this.moveDir(this.project.oldRoot, this.project.newRoot);
  }

  private async updateProjectConfiguration(): Promise<void> {
    this.projectConfig.root = this.project.newRoot;
    this.projectConfig.sourceRoot = this.project.newSourceRoot;

    if (
      !this.projectConfig.targets ||
      !Object.keys(this.projectConfig.targets).length
    ) {
      this.logger.warn(
        'The project does not have any targets configured. This might not be an issue. Skipping updating targets.'
      );
    } else {
      this.updateBuildTargetConfiguration();
      this.updateLintTargetConfiguration();
      this.updateTestTargetConfiguration();
    }

    updateProjectConfiguration(this.tree, this.project.name, {
      ...this.projectConfig,
    });

    await convertToNxProjectGenerator(this.tree, {
      project: this.project.name,
      skipFormat: true,
    });
  }

  private updateNgPackageJson(): void {
    const buildTarget = this.projectConfig.targets?.[this.targetNames.build];
    if (
      !buildTarget?.options?.project ||
      !this.tree.exists(buildTarget.options.project)
    ) {
      // we already logged a warning for these cases, so just return
      return;
    }

    const ngPackageJson = readJson(this.tree, buildTarget.options.project);
    const offset = offsetFromRoot(this.project.newRoot);
    ngPackageJson.$schema =
      ngPackageJson.$schema &&
      `${offset}node_modules/ng-packagr/ng-package.schema.json`;
    ngPackageJson.dest = `${offset}dist/${this.project.name}`;
    writeJson(this.tree, buildTarget.options.project, ngPackageJson);
  }

  private updateTsConfigs(): void {
    const rootTsConfigFile = getRootTsConfigPathInTree(this.tree);
    const projectOffsetFromRoot = offsetFromRoot(this.projectConfig.root);

    this.updateTsConfigFileUsedByBuildTarget(
      rootTsConfigFile,
      projectOffsetFromRoot
    );
    this.updateTsConfigFileUsedByTestTarget(
      rootTsConfigFile,
      projectOffsetFromRoot
    );
  }

  private updateEsLintConfig(): void {
    if (!this.targetNames.lint || !this.tree.exists(this.newEsLintConfigPath)) {
      return;
    }

    updateJson(this.tree, this.newEsLintConfigPath, (json) => {
      delete json.root;
      json.ignorePatterns = ['!**/*'];

      const rootEsLintConfigRelativePath = joinPathFragments(
        offsetFromRoot(this.projectConfig.root),
        '.eslintrc.json'
      );
      if (Array.isArray(json.extends)) {
        json.extends = json.extends.map((extend: string) =>
          this.convertEsLintConfigExtendToNewPath(
            this.oldEsLintConfigPath,
            extend
          )
        );

        // it might have not been extending from the root config, make sure it does
        if (!json.extends.includes(rootEsLintConfigRelativePath)) {
          json.extends.unshift(rootEsLintConfigRelativePath);
        }
      } else {
        json.extends = rootEsLintConfigRelativePath;
      }

      json.overrides?.forEach((override) => {
        if (!override.parserOptions?.project) {
          return;
        }

        override.parserOptions.project = [
          `${this.projectConfig.root}/tsconfig.*?.json`,
        ];
      });

      return json;
    });
  }

  private updateCacheableOperations(): void {
    const workspaceConfig = readWorkspaceConfiguration(this.tree);

    Object.keys(workspaceConfig.tasksRunnerOptions ?? {}).forEach(
      (taskRunnerName) => {
        const taskRunner = workspaceConfig.tasksRunnerOptions[taskRunnerName];
        taskRunner.options.cacheableOperations = Array.from(
          new Set([
            ...(taskRunner.options.cacheableOperations ?? []),
            ...[
              this.targetNames.build,
              this.targetNames.lint,
              this.targetNames.test,
            ].filter(Boolean),
          ])
        );
      }
    );

    updateWorkspaceConfiguration(this.tree, workspaceConfig);
  }

  private updateBuildTargetConfiguration(): void {
    if (!this.targetNames.build) {
      this.logger.warn(
        'There is no build target in the project configuration. This might not be an issue. Skipping updating the build configuration.'
      );
      return;
    }

    const buildTarget = this.projectConfig.targets[this.targetNames.build];
    buildTarget.executor = '@nrwl/angular:package';

    if (
      !buildTarget.options &&
      (!buildTarget.configurations ||
        !Object.keys(buildTarget.configurations).length)
    ) {
      this.logger.warn(
        `The target "${this.targetNames.build}" is not specifying any options or configurations. Skipping updating the target configuration.`
      );
      return;
    }

    const buildDevTsConfig =
      buildTarget.options?.tsConfig ??
      buildTarget.configurations?.development?.tsConfig;
    if (!buildDevTsConfig) {
      this.logger.warn(
        `The "${this.targetNames.build}" target does not have the "tsConfig" option configured. Skipping updating the tsConfig file.`
      );
    } else if (!this.tree.exists(buildDevTsConfig)) {
      this.logger.warn(
        `The tsConfig file "${buildDevTsConfig}" specified in the "${this.targetNames.build}" target could not be found. Skipping updating the tsConfig file.`
      );
    }

    if (!buildTarget.options?.project) {
      this.logger.warn(
        `The "${this.targetNames.build}" target does not have the "project" option configured. Skipping updating the ng-packagr project file ("ng-package.json").`
      );
    } else if (!this.tree.exists(buildTarget.options.project)) {
      this.logger.warn(
        `The ng-packagr project file "${buildTarget.options.project}" specified in the "${this.targetNames.build}" target could not be found. Skipping updating the ng-packagr project file.`
      );
    }

    ['project', 'tsConfig'].forEach((option) => {
      if (buildTarget.options?.[option]) {
        buildTarget.options[option] = joinPathFragments(
          this.project.newRoot,
          basename(buildTarget.options[option])
        );
      }

      for (const configuration of Object.values(
        buildTarget.configurations ?? {}
      )) {
        configuration[option] =
          configuration[option] &&
          joinPathFragments(
            this.project.newRoot,
            basename(configuration[option])
          );
      }
    });
  }

  private updateLintTargetConfiguration(): void {
    if (!this.targetNames.lint) {
      return;
    }

    this.projectConfig.targets[this.targetNames.lint].executor =
      '@nrwl/linter:eslint';

    const lintOptions =
      this.projectConfig.targets[this.targetNames.lint].options;
    if (!lintOptions) {
      this.logger.warn(
        `The target "${this.targetNames.lint}" is not specifying any options. Skipping updating the target configuration.`
      );
      return;
    }

    const existEsLintConfigPath = this.tree.exists(this.newEsLintConfigPath);
    if (!existEsLintConfigPath) {
      this.logger.warn(
        `The ESLint config file "${this.oldEsLintConfigPath}" could not be found. Skipping updating the file.`
      );
    }

    lintOptions.eslintConfig =
      lintOptions.eslintConfig &&
      joinPathFragments(
        this.project.newRoot,
        basename(lintOptions.eslintConfig)
      );
    lintOptions.lintFilePatterns =
      lintOptions.lintFilePatterns &&
      lintOptions.lintFilePatterns.map((pattern) => this.convertPath(pattern));

    if (!existEsLintConfigPath) {
      return;
    }

    const eslintConfig = readJson(this.tree, this.newEsLintConfigPath);
    if (hasRulesRequiringTypeChecking(eslintConfig)) {
      lintOptions.hasTypeAwareRules = true;
    }
  }

  private updateTestTargetConfiguration(): void {
    if (!this.targetNames.test) {
      return;
    }

    const testOptions =
      this.projectConfig.targets[this.targetNames.test].options;
    if (!testOptions) {
      this.logger.warn(
        `The target "${this.targetNames.test}" is not specifying any options. Skipping updating the target configuration.`
      );
      return;
    }

    if (!testOptions.tsConfig) {
      this.logger.warn(
        `The "${this.targetNames.test}" target does not have the "tsConfig" option configured. Skipping updating the tsConfig file.`
      );
    } else if (!this.tree.exists(testOptions.tsConfig)) {
      this.logger.warn(
        `The tsConfig file "${testOptions.tsConfig}" specified in the "${this.targetNames.test}" target could not be found. Skipping updating the tsConfig file.`
      );
    }

    testOptions.main = testOptions.main && this.convertAsset(testOptions.main);
    testOptions.polyfills =
      testOptions.polyfills && this.convertAsset(testOptions.polyfills);
    testOptions.tsConfig =
      testOptions.tsConfig &&
      joinPathFragments(this.project.newRoot, basename(testOptions.tsConfig));
    testOptions.karmaConfig =
      testOptions.karmaConfig &&
      joinPathFragments(
        this.project.newRoot,
        basename(testOptions.karmaConfig)
      );
    testOptions.assets =
      testOptions.assets &&
      testOptions.assets.map((asset) => this.convertAsset(asset));
    testOptions.styles =
      testOptions.styles &&
      testOptions.styles.map((style) => this.convertAsset(style));
    testOptions.scripts =
      testOptions.scripts &&
      testOptions.scripts.map((script) => this.convertAsset(script));
  }

  private updateTsConfigFileUsedByBuildTarget(
    rootTsConfigFile: string,
    projectOffsetFromRoot: string
  ): void {
    if (!this.targetNames.build) {
      return;
    }

    const tsConfigPath =
      this.projectConfig.targets[this.targetNames.build].options?.tsConfig ??
      this.projectConfig.targets[this.targetNames.build].configurations
        ?.development?.tsConfig;

    if (!tsConfigPath || !this.tree.exists(tsConfigPath)) {
      // we already logged a warning for these cases, so just return
      return;
    }

    this.updateTsConfigFile(
      tsConfigPath,
      rootTsConfigFile,
      projectOffsetFromRoot
    );

    updateJson(this.tree, tsConfigPath, (json) => {
      if (!json.include?.length && !json.files?.length) {
        json.include = ['**/*.ts'];
      }

      return json;
    });
  }

  private updateTsConfigFileUsedByTestTarget(
    rootTsConfigFile: string,
    projectOffsetFromRoot: string
  ): void {
    if (!this.targetNames.test) {
      return;
    }

    const tsConfig =
      this.projectConfig.targets[this.targetNames.test].options?.tsConfig;
    if (!tsConfig || !this.tree.exists(tsConfig)) {
      // we already logged a warning for these cases, so just return
      return;
    }

    this.updateTsConfigFile(
      this.projectConfig.targets[this.targetNames.test].options.tsConfig,
      rootTsConfigFile,
      projectOffsetFromRoot
    );
  }
}
