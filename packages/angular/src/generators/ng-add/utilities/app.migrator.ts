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
import { E2eMigrator } from './e2e.migrator';
import { Logger } from './logger';
import { ProjectMigrator } from './project.migrator';
import {
  MigrationProjectConfiguration,
  Target,
  ValidationResult,
} from './types';

type SupportedTargets =
  | 'build'
  | 'e2e'
  | 'i18n'
  | 'lint'
  | 'prerender'
  | 'serve'
  | 'server'
  | 'serveSsr'
  | 'test';
const supportedTargets: Record<SupportedTargets, Target> = {
  build: { builders: ['@angular-devkit/build-angular:browser'] },
  e2e: {
    acceptMultipleDefinitions: true,
    builders: [
      '@angular-devkit/build-angular:protractor',
      '@cypress/schematic:cypress',
    ],
  },
  i18n: { builders: ['@angular-devkit/build-angular:extract-i18n'] },
  lint: { builders: ['@angular-eslint/builder:lint'] },
  prerender: { builders: ['@nguniversal/builders:prerender'] },
  serve: { builders: ['@angular-devkit/build-angular:dev-server'] },
  server: { builders: ['@angular-devkit/build-angular:server'] },
  serveSsr: { builders: ['@nguniversal/builders:ssr-dev-server'] },
  test: { builders: ['@angular-devkit/build-angular:karma'] },
};

export class AppMigrator extends ProjectMigrator<SupportedTargets> {
  private e2eMigrator: E2eMigrator;
  private newEsLintConfigPath: string;
  private oldEsLintConfigPath: string;

  constructor(
    tree: Tree,
    options: GeneratorOptions,
    project: MigrationProjectConfiguration,
    logger?: Logger
  ) {
    super(tree, options, supportedTargets, project, 'apps', logger);

    this.e2eMigrator = new E2eMigrator(
      tree,
      options,
      project,
      this.targetNames.lint
    );

    if (this.targetNames.lint) {
      this.oldEsLintConfigPath =
        this.projectConfig.targets[this.targetNames.lint].options
          ?.eslintConfig ??
        joinPathFragments(this.project.oldRoot, '.eslintrc.json');
      this.newEsLintConfigPath = this.convertRootPath(this.oldEsLintConfigPath);
    }
  }

  async migrate(): Promise<void> {
    await this.e2eMigrator.migrate();

    this.moveProjectFiles();
    await this.updateProjectConfiguration();
    this.updateTsConfigs();
    this.updateEsLintConfig();
    this.updateCacheableOperations(
      [
        this.targetNames.build,
        this.targetNames.lint,
        this.targetNames.test,
        this.targetNames.e2e,
      ].filter(Boolean)
    );
  }

  override validate(): ValidationResult {
    const result: ValidationResult = [
      ...(super.validate() ?? []),
      ...(this.e2eMigrator.validate() ?? []),
    ];

    return result.length ? result : null;
  }

  private moveProjectFiles(): void {
    // project is self-contained and can be safely moved
    if (this.projectConfig.root !== '') {
      this.moveDir(this.project.oldRoot, this.project.newRoot);
      return;
    }

    // we need to pick what to move because the project is in the workspace root

    // it is not required to have a browserslist
    this.moveProjectRootFile('browserslist', false);
    this.moveProjectRootFile('.browserslistrc', false);

    if (this.targetNames.build) {
      this.moveFilePathsFromTargetToProjectRoot(
        this.projectConfig.targets[this.targetNames.build],
        ['tsConfig', 'webWorkerTsConfig', 'ngswConfigPath']
      );
    }

    if (this.targetNames.test) {
      this.moveFilePathsFromTargetToProjectRoot(
        this.projectConfig.targets[this.targetNames.test],
        ['karmaConfig', 'tsConfig', 'webWorkerTsConfig']
      );
    } else {
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

    if (this.targetNames.server) {
      this.moveFilePathsFromTargetToProjectRoot(
        this.projectConfig.targets[this.targetNames.server],
        ['tsConfig']
      );
    }

    if (this.targetNames.lint) {
      this.moveProjectRootFile(this.oldEsLintConfigPath);
    } else {
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

    this.moveDir(this.project.oldSourceRoot, this.project.newSourceRoot);
  }

  private async updateProjectConfiguration(): Promise<void> {
    this.projectConfig.root = this.project.newRoot;
    this.projectConfig.sourceRoot = this.project.newSourceRoot;

    if (
      !this.projectConfig.targets ||
      !Object.keys(this.projectConfig.targets).length
    ) {
      this.logger.warn(
        'The project does not have any targets configured. Skipping updating targets.'
      );
    } else {
      this.updateBuildTargetConfiguration();
      this.updateLintTargetConfiguration();
      this.updateTestTargetConfiguration();
      this.updateServerTargetConfiguration();
      this.updatePrerenderTargetConfiguration();
      this.updateServeSsrTargetConfiguration();
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

    this.updateTsConfigFileUsedByBuildTarget(
      rootTsConfigFile,
      projectOffsetFromRoot
    );
    this.updateTsConfigFileUsedByTestTarget(
      rootTsConfigFile,
      projectOffsetFromRoot
    );
    this.updateTsConfigFileUsedByServerTarget(projectOffsetFromRoot);
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

  private convertBuildOptions(buildOptions: any): void {
    buildOptions.outputPath =
      buildOptions.outputPath &&
      joinPathFragments(
        'dist',
        this.project.newRoot,
        this.targetNames.server ? 'browser' : ''
      );
    buildOptions.index =
      buildOptions.index && this.convertAsset(buildOptions.index);
    buildOptions.main =
      buildOptions.main && this.convertAsset(buildOptions.main);
    buildOptions.polyfills =
      buildOptions.polyfills && this.convertAsset(buildOptions.polyfills);
    buildOptions.tsConfig =
      buildOptions.tsConfig &&
      joinPathFragments(this.project.newRoot, basename(buildOptions.tsConfig));
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
      joinPathFragments('dist', this.project.newRoot, 'server');
    serverOptions.main =
      serverOptions.main && this.convertPath(serverOptions.main);
    serverOptions.tsConfig =
      serverOptions.tsConfig &&
      joinPathFragments(this.project.newRoot, basename(serverOptions.tsConfig));
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

  private updateBuildTargetConfiguration(): void {
    if (!this.targetNames.build) {
      this.logger.warn(
        'There is no build target in the project configuration. Skipping updating the build target configuration.'
      );
      return;
    }

    const buildTarget = this.projectConfig.targets[this.targetNames.build];

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

    this.convertBuildOptions(buildTarget.options ?? {});
    Object.values(buildTarget.configurations ?? {}).forEach((config) =>
      this.convertBuildOptions(config)
    );
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

    const eslintConfig = readJson(this.tree, this.newEsLintConfigPath);
    if (hasRulesRequiringTypeChecking(eslintConfig)) {
      lintOptions.hasTypeAwareRules = true;
    }
  }

  private updatePrerenderTargetConfiguration(): void {
    if (!this.targetNames.prerender) {
      return;
    }

    const prerenderTarget =
      this.projectConfig.targets[this.targetNames.prerender];
    if (!prerenderTarget.options) {
      this.logger.warn(
        `The target "${this.targetNames.prerender}" is not specifying any options. Skipping updating the target configuration.`
      );
      return;
    }

    prerenderTarget.options.routesFile =
      prerenderTarget.options.routesFile &&
      this.convertPath(prerenderTarget.options.routesFile);
  }

  private updateServerTargetConfiguration(): void {
    if (!this.targetNames.server) {
      return;
    }

    const serverTarget = this.projectConfig.targets[this.targetNames.server];

    if (
      !serverTarget.options &&
      (!serverTarget.configurations ||
        !Object.keys(serverTarget.configurations).length)
    ) {
      this.logger.warn(
        `The target "${this.targetNames.server}" is not specifying any options or configurations. Skipping updating the target configuration.`
      );
      return;
    }

    const serverDevTsConfig =
      serverTarget.options?.tsConfig ??
      serverTarget.configurations?.development?.tsConfig;
    if (!serverDevTsConfig) {
      this.logger.warn(
        `The "${this.targetNames.server}" target does not have the "tsConfig" option configured. Skipping updating the tsConfig file.`
      );
    } else if (!this.tree.exists(serverDevTsConfig)) {
      this.logger.warn(
        `The tsConfig file "${serverDevTsConfig}" specified in the "${this.targetNames.server}" target could not be found. Skipping updating the tsConfig file.`
      );
    }

    this.convertServerOptions(serverTarget.options ?? {});
    Object.values(serverTarget.configurations ?? {}).forEach((config) =>
      this.convertServerOptions(config)
    );
  }

  private updateServeSsrTargetConfiguration(): void {
    if (!this.targetNames.serveSsr) {
      return;
    }

    const serveSsrTarget =
      this.projectConfig.targets[this.targetNames.serveSsr];
    if (
      !serveSsrTarget.options &&
      (!serveSsrTarget.configurations ||
        !Object.keys(serveSsrTarget.configurations).length)
    ) {
      this.logger.warn(
        `The target "${this.targetNames.serveSsr}" is not specifying any options or configurations. Skipping updating the target configuration.`
      );
      return;
    }

    ['sslKey', 'sslCert', 'proxyConfig'].forEach((option) => {
      if (serveSsrTarget.options) {
        serveSsrTarget.options[option] =
          serveSsrTarget.options[option] &&
          this.convertPath(serveSsrTarget.options[option]);
      }

      for (const configuration of Object.values(
        serveSsrTarget.configurations ?? {}
      )) {
        serveSsrTarget.configurations[configuration][option] =
          serveSsrTarget.configurations[configuration][option] &&
          this.convertPath(
            serveSsrTarget.configurations[configuration][option]
          );
      }
    });
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
  }

  private updateTsConfigFileUsedByServerTarget(
    projectOffsetFromRoot: string
  ): void {
    if (!this.targetNames.server) {
      return;
    }

    const tsConfigPath =
      this.projectConfig.targets[this.targetNames.server].options?.tsConfig ??
      this.projectConfig.targets[this.targetNames.server].configurations
        ?.development?.tsConfig;

    if (!tsConfigPath || !this.tree.exists(tsConfigPath)) {
      // we already logged a warning for these cases, so just return
      return;
    }

    updateJson(this.tree, tsConfigPath, (json) => {
      json.compilerOptions = json.compilerOptions ?? {};
      json.compilerOptions.outDir = `${projectOffsetFromRoot}dist/out-tsc`;
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

    this.updateTsConfigFile(tsConfig, rootTsConfigFile, projectOffsetFromRoot);
  }
}
