import { joinPathFragments, Tree } from '@nx/devkit';
import { updateProjectConfiguration } from '@nx/devkit';
import type { GeneratorOptions } from '../../schema';
import type {
  Logger,
  MigrationProjectConfiguration,
  ValidationError,
  ValidationResult,
} from '../../utilities';
import { convertToNxProject } from '../../utilities';
import type { BuilderMigratorClassType } from '../builders';
import {
  AngularDevkitKarmaMigrator,
  AngularDevkitNgPackagrMigrator,
  AngularEslintLintMigrator,
} from '../builders';
import { ProjectMigrator } from './project.migrator';

const supportedBuilderMigrators: BuilderMigratorClassType[] = [
  AngularDevkitNgPackagrMigrator,
  AngularDevkitKarmaMigrator,
  AngularEslintLintMigrator,
];

export class LibMigrator extends ProjectMigrator {
  constructor(
    tree: Tree,
    options: GeneratorOptions,
    project: MigrationProjectConfiguration,
    logger?: Logger
  ) {
    super(
      tree,
      options,
      {},
      project,
      'libs',
      logger,
      supportedBuilderMigrators
    );
  }

  override async migrate(): Promise<void> {
    if (this.skipMigration === true) {
      return;
    }

    await super.migrate();

    await this.updateProjectConfiguration();
    this.moveProjectFiles();

    for (const builderMigrator of this.builderMigrators ?? []) {
      await builderMigrator.migrate();
    }
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
    convertToNxProject(this.tree, this.project.name);
    this.moveFile(
      joinPathFragments(this.project.oldRoot, 'project.json'),
      joinPathFragments(this.project.newRoot, 'project.json')
    );

    this.projectConfig.root = this.project.newRoot;
    this.projectConfig.sourceRoot = this.project.newSourceRoot;

    if (
      !this.projectConfig.targets ||
      !Object.keys(this.projectConfig.targets).length
    ) {
      this.logger.warn(
        'The project does not have any targets configured. This might not be an issue. Skipping updating targets.'
      );
    }

    updateProjectConfiguration(this.tree, this.project.name, {
      ...this.projectConfig,
    });
  }
}
