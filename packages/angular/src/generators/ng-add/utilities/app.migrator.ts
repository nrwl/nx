import {
  joinPathFragments,
  offsetFromRoot,
  readJson,
  TargetConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { hasRulesRequiringTypeChecking } from '@nrwl/linter';
import { convertToNxProjectGenerator } from '@nrwl/workspace/generators';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { basename } from 'path';
import { GeneratorOptions } from '../schema';
import { E2eProjectMigrator } from './e2e.migrator';
import { ProjectMigrator } from './project.migrator';
import { MigrationProjectConfiguration, ValidationResult } from './types';

export class AppMigrator extends ProjectMigrator {
  private e2eMigrator: E2eProjectMigrator;

  constructor(
    tree: Tree,
    options: GeneratorOptions,
    project: MigrationProjectConfiguration
  ) {
    super(tree, options, project, 'apps');

    this.e2eMigrator = new E2eProjectMigrator(tree, options, project);
  }

  async migrate(): Promise<void> {
    await this.e2eMigrator.migrate();

    this.moveProjectFiles();
    await this.updateProjectConfiguration();
    this.updateTsConfigs();
    this.updateEsLintConfig();
  }

  validate(): ValidationResult {
    const result: ValidationResult = [];

    if (
      this.projectConfig.targets.lint &&
      this.projectConfig.targets.lint.executor !==
        '@angular-eslint/builder:lint'
    ) {
      result.push({
        message: `The "lint" target is using an unsupported builder "${this.projectConfig.targets.lint.executor}".`,
        hint: `The supported builder is "@angular-eslint/builder:lint".`,
      });
    }

    result.push(...(this.e2eMigrator.validate() ?? []));

    return result.length ? result : null;
  }

  private moveProjectFiles(): void {
    // it is not required to have a browserslist
    this.moveProjectRootFile(
      joinPathFragments(this.project.oldRoot, 'browserslist'),
      false
    );
    this.moveProjectRootFile(
      joinPathFragments(this.project.oldRoot, '.browserslistrc'),
      false
    );

    this.moveFilePathsFromTargetToProjectRoot(
      this.projectConfig.targets.build,
      ['tsConfig', 'webWorkerTsConfig', 'ngswConfigPath']
    );

    if (this.projectConfig.targets.test) {
      this.moveFilePathsFromTargetToProjectRoot(
        this.projectConfig.targets.test,
        ['karmaConfig', 'tsConfig', 'webWorkerTsConfig']
      );
    } else {
      // there could still be a karma.conf.js file in the root
      // so move to new location
      const karmaConfig = joinPathFragments(
        this.project.oldRoot,
        'karma.conf.js'
      );
      if (this.tree.exists(karmaConfig)) {
        this.logger.info(
          'No "test" target was found, but a root Karma config file was found in the project root. The file will be moved to the new location.'
        );
        this.moveProjectRootFile(karmaConfig);
      }
    }

    if (this.projectConfig.targets.server) {
      this.moveProjectRootFile(
        this.projectConfig.targets.server.options.tsConfig
      );
    }

    if (this.projectConfig.targets.lint) {
      this.moveProjectRootFile(
        this.projectConfig.targets.lint.options.eslintConfig ??
          joinPathFragments(this.project.oldRoot, '.eslintrc.json')
      );
    } else {
      // there could still be a .eslintrc.json file in the root
      // so move to new location
      const eslintConfig = joinPathFragments(
        this.project.oldRoot,
        '.eslintrc.json'
      );
      if (this.tree.exists(eslintConfig)) {
        this.logger.info(
          'No "lint" target was found, but an ESLint config file was found in the project root. The file will be moved to the new location.'
        );
        this.moveProjectRootFile(eslintConfig);
      }
    }

    this.moveDir(this.project.oldSourceRoot, this.project.newSourceRoot);
  }

  private async updateProjectConfiguration(): Promise<void> {
    this.projectConfig.root = this.project.newRoot;
    this.projectConfig.sourceRoot = this.project.newSourceRoot;

    this.convertBuildOptions(this.projectConfig.targets.build.options);
    Object.values(
      this.projectConfig.targets.build.configurations ?? {}
    ).forEach((config) => this.convertBuildOptions(config));

    if (this.projectConfig.targets.test) {
      const testOptions = this.projectConfig.targets.test.options;
      testOptions.main =
        testOptions.main && this.convertAsset(testOptions.main);
      testOptions.polyfills =
        testOptions.polyfills && this.convertAsset(testOptions.polyfills);
      testOptions.tsConfig = joinPathFragments(
        this.project.newRoot,
        'tsconfig.spec.json'
      );
      testOptions.karmaConfig = joinPathFragments(
        this.project.newRoot,
        'karma.conf.js'
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

    if (this.projectConfig.targets.lint) {
      this.projectConfig.targets.lint.executor = '@nrwl/linter:eslint';
      const lintOptions = this.projectConfig.targets.lint.options;
      lintOptions.eslintConfig =
        lintOptions.eslintConfig &&
        joinPathFragments(
          this.project.newRoot,
          basename(lintOptions.eslintConfig)
        );
      lintOptions.lintFilePatterns =
        lintOptions.lintFilePatterns &&
        lintOptions.lintFilePatterns.map((pattern) =>
          this.convertPath(pattern)
        );

      const eslintConfigPath =
        lintOptions.eslintConfig ??
        joinPathFragments(this.project.newRoot, '.eslintrc.json');
      const eslintConfig = readJson(this.tree, eslintConfigPath);
      if (hasRulesRequiringTypeChecking(eslintConfig)) {
        lintOptions.hasTypeAwareRules = true;
      }
    }

    if (this.projectConfig.targets.server) {
      const serverOptions = this.projectConfig.targets.server.options;
      this.convertServerOptions(serverOptions);
      Object.values(this.projectConfig.targets.server.configurations).forEach(
        (config) => this.convertServerOptions(config)
      );
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

    this.updateTsConfigFile(
      this.projectConfig.targets.build.options.tsConfig,
      rootTsConfigFile,
      projectOffsetFromRoot
    );

    if (this.projectConfig.targets.test) {
      this.updateTsConfigFile(
        this.projectConfig.targets.test.options.tsConfig,
        rootTsConfigFile,
        projectOffsetFromRoot
      );
    }

    if (this.projectConfig.targets.server) {
      this.updateTsConfigFile(
        this.projectConfig.targets.server.options.tsConfig,
        rootTsConfigFile,
        projectOffsetFromRoot
      );
    }
  }

  private updateEsLintConfig(): void {
    const eslintConfigPath =
      this.projectConfig.targets.lint?.options?.eslintConfig ??
      joinPathFragments(this.project.newRoot, '.eslintrc.json');

    if (!this.tree.exists(eslintConfigPath)) {
      return;
    }

    updateJson(this.tree, eslintConfigPath, (json) => {
      delete json.root;
      json.ignorePatterns = ['!**/*'];

      const rootEsLintConfigRelativePath = joinPathFragments(
        offsetFromRoot(this.projectConfig.root),
        '.eslintrc.json'
      );
      if (Array.isArray(json.extends)) {
        json.extends = json.extends.map((extend: string) =>
          this.convertEsLintConfigExtendToNewPath(eslintConfigPath, extend)
        );

        // it might have not been extending from the root config, make sure it does
        if (!json.extends.includes(rootEsLintConfigRelativePath)) {
          json.extends.push(rootEsLintConfigRelativePath);
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

  private convertBuildOptions(buildOptions: any): void {
    buildOptions.outputPath =
      buildOptions.outputPath &&
      joinPathFragments('dist', this.project.newRoot);
    buildOptions.index =
      buildOptions.index && this.convertAsset(buildOptions.index);
    buildOptions.main =
      buildOptions.main && this.convertAsset(buildOptions.main);
    buildOptions.polyfills =
      buildOptions.polyfills && this.convertAsset(buildOptions.polyfills);
    buildOptions.tsConfig =
      buildOptions.tsConfig &&
      joinPathFragments(this.project.newRoot, 'tsconfig.app.json');
    buildOptions.assets =
      buildOptions.assets &&
      buildOptions.assets.map((asset) => this.convertAsset(asset));
    buildOptions.styles =
      buildOptions.styles &&
      buildOptions.styles.map((style) => this.convertAsset(style));
    buildOptions.scripts =
      buildOptions.scripts &&
      buildOptions.scripts.map((script) => this.convertAsset(script));
    buildOptions.fileReplacements =
      buildOptions.fileReplacements &&
      buildOptions.fileReplacements.map((replacement: any) => ({
        replace: this.convertAsset(replacement.replace),
        with: this.convertAsset(replacement.with),
      }));
  }

  private convertServerOptions(serverOptions: any): void {
    serverOptions.outputPath =
      serverOptions.outputPath &&
      joinPathFragments('dist', 'apps', `${this.project.name}-server`);
    serverOptions.main =
      serverOptions.main && this.convertAsset(serverOptions.main);
    serverOptions.tsConfig =
      serverOptions.tsConfig &&
      joinPathFragments(this.project.newRoot, 'tsconfig.server.json');
    serverOptions.fileReplacements =
      serverOptions.fileReplacements &&
      serverOptions.fileReplacements.map((replacement) => ({
        replace: this.convertAsset(replacement.replace),
        with: this.convertAsset(replacement.with),
      }));
  }

  private moveFilePathsFromTargetToProjectRoot(
    target: TargetConfiguration,
    options: string[]
  ) {
    options.forEach((option) => {
      this.getTargetValuesForOption(target, option).forEach((path) => {
        this.moveProjectRootFile(path);
      });
    });
  }
}
