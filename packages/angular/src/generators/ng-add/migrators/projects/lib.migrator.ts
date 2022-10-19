import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  offsetFromRoot,
  readJson,
  updateJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { hasRulesRequiringTypeChecking } from '@nrwl/linter';
import { convertToNxProjectGenerator } from '@nrwl/workspace/generators';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { basename } from 'path';
import type { GeneratorOptions } from '../../schema';
import type {
  Logger,
  MigrationProjectConfiguration,
  Target,
  ValidationError,
  ValidationResult,
} from '../../utilities';
import type { BuilderMigratorClassType } from '../builders';
import { AngularDevkitNgPackagrMigrator } from '../builders';
import { ProjectMigrator } from './project.migrator';

type SupportedTargets = 'test' | 'lint';
const supportedTargets: Record<SupportedTargets, Target> = {
  test: { builders: ['@angular-devkit/build-angular:karma'] },
  lint: { builders: ['@angular-eslint/builder:lint'] },
};
// TODO(leo): this will replace `supportedTargets` once the full refactor is done.
const supportedBuilderMigrators: BuilderMigratorClassType[] = [
  AngularDevkitNgPackagrMigrator,
];

export class LibMigrator extends ProjectMigrator<SupportedTargets> {
  private oldEsLintConfigPath: string;
  private newEsLintConfigPath: string;

  constructor(
    tree: Tree,
    options: GeneratorOptions,
    project: MigrationProjectConfiguration,
    logger?: Logger
  ) {
    super(
      tree,
      options,
      supportedTargets,
      project,
      'libs',
      logger,
      supportedBuilderMigrators
    );

    if (this.targetNames.lint) {
      this.oldEsLintConfigPath =
        this.projectConfig.targets[this.targetNames.lint].options
          ?.eslintConfig ??
        joinPathFragments(this.project.oldRoot, '.eslintrc.json');
      this.newEsLintConfigPath = this.convertRootPath(this.oldEsLintConfigPath);
    }
  }

  override async migrate(): Promise<void> {
    await this.updateProjectConfiguration();
    this.moveProjectFiles();

    for (const builderMigrator of this.builderMigrators ?? []) {
      await builderMigrator.migrate();
    }

    this.updateTsConfigs();
    this.updateEsLintConfig();
    this.updateCacheableOperations(
      [this.targetNames.lint, this.targetNames.test].filter(Boolean)
    );
  }

  override validate(): ValidationResult {
    const errors: ValidationError[] = [...(super.validate() ?? [])];

    for (const builderMigrator of this.builderMigrators) {
      errors.push(...(builderMigrator.validate() ?? []));
    }

    return errors.length ? errors : null;
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

  private updateTsConfigs(): void {
    const rootTsConfigFile = getRootTsConfigPathInTree(this.tree);
    const projectOffsetFromRoot = offsetFromRoot(this.projectConfig.root);

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

    const existEsLintConfigPath = this.tree.exists(this.oldEsLintConfigPath);
    if (!existEsLintConfigPath) {
      this.logger.warn(
        `The ESLint config file "${this.oldEsLintConfigPath}" could not be found. Skipping updating the file.`
      );
    }

    lintOptions.eslintConfig =
      lintOptions.eslintConfig && this.newEsLintConfigPath;
    lintOptions.lintFilePatterns =
      lintOptions.lintFilePatterns &&
      lintOptions.lintFilePatterns.map((pattern) => {
        // replace the old source root with the new root, we want to lint all
        // matching files in the project, not just the ones in the source root
        if (pattern.startsWith(this.project.oldSourceRoot)) {
          return joinPathFragments(
            this.project.newRoot,
            pattern.replace(this.project.oldSourceRoot, '')
          );
        }

        // replace the old root with the new root
        if (pattern.startsWith(this.project.oldRoot)) {
          return joinPathFragments(
            this.project.newRoot,
            pattern.replace(this.project.oldRoot, '')
          );
        }

        // do nothing, warn about the pattern
        this.logger.warn(
          `The lint file pattern "${pattern}" specified in the "${this.targetNames.lint}" target is not contained in the project root or source root. The pattern will not be updated.`
        );

        return pattern;
      });

    if (!existEsLintConfigPath) {
      return;
    }

    const eslintConfig = readJson(this.tree, this.oldEsLintConfigPath);
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
