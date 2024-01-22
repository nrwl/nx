import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import type {
  Logger,
  ProjectMigrationInfo,
  ValidationError,
  ValidationResult,
  WorkspaceRootFileType,
} from '../../utilities';
import { arrayToString } from '../../utilities';
import { Migrator } from '../migrator';

export abstract class BuilderMigrator extends Migrator {
  targets: Map<string, TargetConfiguration> = new Map();

  protected skipMigration: boolean = false;

  constructor(
    tree: Tree,
    public readonly builderName: string,
    public readonly rootFileType: WorkspaceRootFileType | undefined,
    project: ProjectMigrationInfo,
    projectConfig: ProjectConfiguration,
    logger: Logger
  ) {
    super(tree, projectConfig, logger);

    this.project = project;
    this.projectConfig = projectConfig;

    this.collectBuilderTargets();
  }

  override validate(): ValidationResult {
    const errors: ValidationError[] = [];
    // TODO(leo): keeping restriction until the full refactor is done and we start
    // expanding what's supported.
    if (this.targets.size > 1) {
      errors.push({
        message: `There is more than one target using the builder "${
          this.builderName
        }": ${arrayToString([
          ...this.targets.keys(),
        ])}. This is not currently supported by the automated migration. These targets will be skipped.`,
        hint: 'Make sure to manually migrate their configuration and any possible associated files.',
      });
      this.skipMigration = true;
    }

    return errors.length ? errors : null;
  }

  isBuilderUsed(): boolean {
    return this.targets.size > 0;
  }

  protected collectBuilderTargets(): void {
    for (const [name, target] of Object.entries(
      this.projectConfig.targets ?? {}
    )) {
      if (target.executor === this.builderName) {
        this.targets.set(name, target);
      }
    }
  }
}
