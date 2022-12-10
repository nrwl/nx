import {
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { basename } from 'path';
import type {
  Logger,
  ProjectMigrationInfo,
  ValidationError,
  ValidationResult,
} from '../../utilities';
import { arrayToString } from '../../utilities';
import { BuilderMigrator } from './builder.migrator';

export class AngularDevkitKarmaMigrator extends BuilderMigrator {
  constructor(
    tree: Tree,
    project: ProjectMigrationInfo,
    projectConfig: ProjectConfiguration,
    logger: Logger
  ) {
    super(
      tree,
      '@angular-devkit/build-angular:karma',
      'karma',
      project,
      projectConfig,
      logger
    );
  }

  override migrate(): void {
    for (const [name, target] of this.targets) {
      this.moveFilePathsFromTargetToProjectRoot(target, [
        'karmaConfig',
        'tsConfig',
        'webWorkerTsConfig',
      ]);
      this.updateTargetConfiguration(name, target);
      this.updateTsConfigFileUsedByTestTarget(name, target);
      this.updateCacheableOperations([name]);
    }

    if (!this.targets.size && this.projectConfig.root === '') {
      // there could still be a karma.conf.js file in the root
      // so move to new location
      const karmaConfig = 'karma.conf.js';
      if (this.tree.exists(karmaConfig)) {
        this.logger.info(
          'No "test" target was found, but a root Karma config file was found in the project root. The file will be moved to the new location.'
        );
        this.moveProjectRootFile(karmaConfig);
      }
    }
  }

  override validate(): ValidationResult {
    const errors: ValidationError[] = [];
    // TODO(leo): keeping restriction until the full refactor is done and we start
    // expanding what's supported.
    if (this.targets.size > 1) {
      errors.push({
        message: `There is more than one target using a builder that is used to build the project (${arrayToString(
          [...this.targets.keys()]
        )}).`,
        hint: `Make sure the project only has one target with a builder that is used to build the project.`,
      });
    }

    return errors.length ? errors : null;
  }

  private updateTargetConfiguration(
    targetName: string,
    target: TargetConfiguration
  ): void {
    if (!target.options) {
      this.logger.warn(
        `The target "${targetName}" is not specifying any options. Skipping updating the target configuration.`
      );
      return;
    }

    target.options.main =
      target.options.main && this.convertAsset(target.options.main);
    target.options.polyfills = Array.isArray(target.options.polyfills)
      ? target.options.polyfills.map((p) => this.convertAsset(p))
      : target.options.polyfills && this.convertAsset(target.options.polyfills);
    target.options.tsConfig =
      target.options.tsConfig &&
      joinPathFragments(
        this.project.newRoot,
        basename(target.options.tsConfig)
      );
    target.options.karmaConfig =
      target.options.karmaConfig &&
      joinPathFragments(
        this.project.newRoot,
        basename(target.options.karmaConfig)
      );
    target.options.assets =
      target.options.assets &&
      target.options.assets.map((asset) => this.convertAsset(asset));
    target.options.styles =
      target.options.styles &&
      target.options.styles.map((style) => this.convertAsset(style));
    target.options.scripts =
      target.options.scripts &&
      target.options.scripts.map((script) => this.convertAsset(script));

    updateProjectConfiguration(this.tree, this.project.name, {
      ...this.projectConfig,
    });
  }

  private updateTsConfigFileUsedByTestTarget(
    targetName: string,
    target: TargetConfiguration
  ): void {
    if (!target.options?.tsConfig) {
      this.logger.warn(
        `The "${targetName}" target does not have the "tsConfig" option configured. Skipping updating the tsConfig file.`
      );
      return;
    }
    if (!this.tree.exists(target.options.tsConfig)) {
      const originalTsConfigPath =
        this.originalProjectConfig.targets[targetName].options.tsConfig;
      this.logger.warn(
        `The tsConfig file "${originalTsConfigPath}" specified in the "${targetName}" target could not be found. Skipping updating the tsConfig file.`
      );
      return;
    }

    this.updateTsConfigFile(
      target.options.tsConfig,
      getRootTsConfigPathInTree(this.tree),
      offsetFromRoot(this.projectConfig.root)
    );
  }
}
