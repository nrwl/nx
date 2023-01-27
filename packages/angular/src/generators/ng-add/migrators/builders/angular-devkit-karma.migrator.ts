import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nrwl/devkit';
import {
  joinPathFragments,
  offsetFromRoot,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { basename } from 'path';
import type { Logger, ProjectMigrationInfo } from '../../utilities';
import { BuilderMigrator } from './builder.migrator';
import { tsquery } from '@phenomnomnominal/tsquery';

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
    if (this.skipMigration) {
      return;
    }

    for (const [name, target] of this.targets) {
      this.moveFilePathsFromTargetToProjectRoot(target, [
        'karmaConfig',
        'tsConfig',
        'webWorkerTsConfig',
      ]);
      this.removeWatchFromKarmaConf(target);
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

  private removeWatchFromKarmaConf(target: TargetConfiguration) {
    const karmaConfFiles = this.getTargetValuesForOption(target, 'karmaConfig');
    for (const file of karmaConfFiles) {
      if (!this.tree.exists(file)) {
        continue;
      }

      const karmaConfFileContents = this.tree.read(file, 'utf-8');
      const ast = tsquery.ast(karmaConfFileContents);

      const HAS_SINGLE_RUN_FALSE_SELECTOR = `PropertyAssignment:has(Identifier[name=singleRun]) > FalseKeyword`;
      const nodes = tsquery(ast, HAS_SINGLE_RUN_FALSE_SELECTOR, {
        visitAllChildren: true,
      });
      if (nodes.length === 0) {
        continue;
      }

      const SINGLE_RUN_FALSE_SELECTOR = `PropertyAssignment:has(Identifier[name=singleRun])`;
      const node = tsquery(ast, SINGLE_RUN_FALSE_SELECTOR, {
        visitAllChildren: true,
      })[0];

      const newFileContents = `${karmaConfFileContents.slice(
        0,
        node.getStart()
      )}singleRun: true${karmaConfFileContents.slice(node.getEnd())}`;

      this.tree.write(file, newFileContents);
    }
  }
}
