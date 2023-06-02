import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import {
  joinPathFragments,
  offsetFromRoot,
  readJson,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { hasRulesRequiringTypeChecking } from '@nx/linter';
import { dirname } from 'path';
import type { Logger, ProjectMigrationInfo } from '../../utilities';
import { BuilderMigrator } from './builder.migrator';

export class AngularEslintLintMigrator extends BuilderMigrator {
  private oldEsLintConfigPath: string;
  private newEsLintConfigPath: string;

  constructor(
    tree: Tree,
    project: ProjectMigrationInfo,
    projectConfig: ProjectConfiguration,
    logger: Logger
  ) {
    super(
      tree,
      '@angular-eslint/builder:lint',
      'eslint',
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
      this.oldEsLintConfigPath =
        target.options?.eslintConfig ??
        joinPathFragments(this.project.oldRoot, '.eslintrc.json');
      this.newEsLintConfigPath = this.convertRootPath(this.oldEsLintConfigPath);

      this.moveProjectRootFile(this.oldEsLintConfigPath);
      this.updateTargetConfiguration(name, target);
      this.updateEsLintConfig();
      this.updateCacheableOperations([name]);
    }

    if (!this.targets.size && this.projectConfig.root === '') {
      // there could still be a .eslintrc.json file in the root
      // so move to new location
      const eslintConfig = '.eslintrc.json';
      if (this.tree.exists(eslintConfig)) {
        this.logger.info(
          'No "lint" target was found, but an ESLint config file was found in the project root. The file will be moved to the new location.'
        );
        this.moveProjectRootFile(eslintConfig);
      }
    }
  }

  private async updateTargetConfiguration(
    targetName: string,
    target: TargetConfiguration
  ): Promise<void> {
    target.executor = '@nx/linter:eslint';

    if (!target.options) {
      this.logger.warn(
        `The target "${targetName}" is not specifying any options. Skipping updating the target configuration.`
      );
      return;
    }

    const existEsLintConfigPath = this.tree.exists(this.newEsLintConfigPath);
    if (!existEsLintConfigPath) {
      this.logger.warn(
        `The ESLint config file "${this.oldEsLintConfigPath}" could not be found. Skipping updating the file.`
      );
    }

    target.options.eslintConfig =
      target.options.eslintConfig && this.newEsLintConfigPath;
    target.options.lintFilePatterns =
      target.options.lintFilePatterns &&
      target.options.lintFilePatterns.map((pattern) => {
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
          `The lint file pattern "${pattern}" specified in the "${targetName}" target is not contained in the project root or source root. The pattern will not be updated.`
        );

        return pattern;
      });

    if (existEsLintConfigPath) {
      const eslintConfig = readJson(this.tree, this.newEsLintConfigPath);
      if (hasRulesRequiringTypeChecking(eslintConfig)) {
        target.options.hasTypeAwareRules = true;
      }
    }

    updateProjectConfiguration(this.tree, this.project.name, {
      ...this.projectConfig,
    });
  }

  private updateEsLintConfig(): void {
    if (!this.tree.exists(this.newEsLintConfigPath)) {
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

  private convertEsLintConfigExtendToNewPath(
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
}
