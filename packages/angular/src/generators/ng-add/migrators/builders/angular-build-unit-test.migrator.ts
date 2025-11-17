import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import {
  joinPathFragments,
  offsetFromRoot,
  updateProjectConfiguration,
} from '@nx/devkit';
import { getRootTsConfigPathInTree } from '@nx/js';
import { basename } from 'path';
import type { Logger, ProjectMigrationInfo } from '../../utilities';
import { BuilderMigrator } from './builder.migrator';

export class AngularBuildUnitTestMigrator extends BuilderMigrator {
  constructor(
    tree: Tree,
    project: ProjectMigrationInfo,
    projectConfig: ProjectConfiguration,
    logger: Logger
  ) {
    const rootFileType = determineRootFileType(projectConfig);

    super(
      tree,
      ['@angular/build:unit-test'],
      rootFileType,
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
      this.moveConfigFiles(target);
      this.updateTargetConfiguration(name, target);
      this.updateTsConfigFileUsedByTestTarget(name, target);
      this.updateCacheableOperations([name]);
    }

    if (!this.targets.size && this.projectConfig.root === '') {
      this.handleRootProjectConfigFiles();
    }
  }

  private moveConfigFiles(target: TargetConfiguration): void {
    const filePathOptions: string[] = ['tsConfig'];

    if (typeof target.options?.runnerConfig === 'string') {
      filePathOptions.push('runnerConfig');
    }

    if (target.options?.providersFile) {
      filePathOptions.push('providersFile');
    }

    this.moveFilePathsFromTargetToProjectRoot(target, filePathOptions);

    if (Array.isArray(target.options?.setupFiles)) {
      target.options.setupFiles.forEach((file: string) => {
        if (this.tree.exists(file)) {
          this.moveProjectRootFile(file);
        }
      });
    }

    if (Array.isArray(target.options?.reporters)) {
      this.moveCustomReporterFiles(target.options.reporters);
    }

    for (const config of Object.values(target.configurations ?? {})) {
      if (Array.isArray(config.reporters)) {
        this.moveCustomReporterFiles(config.reporters);
      }
    }
  }

  private moveCustomReporterFiles(reporters: (string | [string, any])[]): void {
    reporters.forEach((reporter) => {
      const reporterPath = Array.isArray(reporter) ? reporter[0] : reporter;
      if (
        typeof reporterPath === 'string' &&
        reporterPath.includes('/') &&
        this.tree.exists(reporterPath)
      ) {
        this.moveProjectRootFile(reporterPath);
      }
    });
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

    this.updateConfigurationOptions(target.options);

    for (const config of Object.values(target.configurations ?? {})) {
      this.updateConfigurationOptions(config);
    }

    updateProjectConfiguration(this.tree, this.project.name, {
      ...this.projectConfig,
    });
  }

  private updateConfigurationOptions(options: Record<string, any>): void {
    if (options.tsConfig || options.tsconfig) {
      const tsConfigKey = options.tsConfig ? 'tsConfig' : 'tsconfig';
      options[tsConfigKey] = joinPathFragments(
        this.project.newRoot,
        basename(options[tsConfigKey])
      );
    }

    if (typeof options.runnerConfig === 'string') {
      options.runnerConfig = joinPathFragments(
        this.project.newRoot,
        basename(options.runnerConfig)
      );
    }

    if (options.outputFile) {
      options.outputFile = this.convertRootPath(options.outputFile);
    }

    if (options.providersFile) {
      options.providersFile = this.convertAsset(options.providersFile);
    }

    if (Array.isArray(options.setupFiles)) {
      options.setupFiles = options.setupFiles.map((file: string) =>
        this.convertAsset(file)
      );
    }

    if (Array.isArray(options.reporters)) {
      options.reporters = this.updateReporterPaths(options.reporters);
    }
  }

  private updateReporterPaths(
    reporters: (string | [string, any])[]
  ): (string | [string, any])[] {
    return reporters.map((reporter) => {
      if (Array.isArray(reporter)) {
        const [reporterPath, reporterOptions] = reporter;
        if (typeof reporterPath === 'string' && reporterPath.includes('/')) {
          return [this.convertAsset(reporterPath), reporterOptions];
        }
        return reporter;
      } else if (typeof reporter === 'string' && reporter.includes('/')) {
        return this.convertAsset(reporter);
      }
      return reporter;
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

  private handleRootProjectConfigFiles(): void {
    const runner = this.getRunnerOption();

    if (runner === 'karma') {
      const karmaConfig = 'karma.conf.js';
      if (this.tree.exists(karmaConfig)) {
        this.logger.info(
          'No "test" target was found, but a root Karma config file was found in the project root. The file will be moved to the new location.'
        );
        this.moveProjectRootFile(karmaConfig);
      }
    } else {
      const vitestConfigs = ['vitest.config.ts', 'vitest.config.js'];
      for (const vitestConfig of vitestConfigs) {
        if (this.tree.exists(vitestConfig)) {
          this.logger.info(
            'No "test" target was found, but a root Vitest config file was found in the project root. The file will be moved to the new location.'
          );
          this.moveProjectRootFile(vitestConfig);
          break;
        }
      }
    }
  }

  private getRunnerOption(): 'karma' | 'vitest' {
    for (const [, target] of this.targets) {
      if (target.options?.runner) {
        return target.options.runner;
      }
    }
    return 'vitest';
  }
}

function determineRootFileType(
  projectConfig: ProjectConfiguration
): 'karma' | undefined {
  const testTargets = Object.values(projectConfig.targets ?? {}).filter(
    (target) => target.executor === '@angular/build:unit-test'
  );

  for (const target of testTargets) {
    if (target.options?.runner === 'karma') {
      return 'karma';
    }
  }

  return undefined;
}
