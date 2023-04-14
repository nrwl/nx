import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  offsetFromRoot,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { getRootTsConfigPathInTree } from '@nx/js';
import { basename } from 'path';
import type { GeneratorOptions } from '../../schema';
import type {
  Logger,
  MigrationProjectConfiguration,
  Target,
  ValidationResult,
} from '../../utilities';
import { convertToNxProject } from '../../utilities';
import type { BuilderMigratorClassType } from '../builders';
import {
  AngularDevkitKarmaMigrator,
  AngularEslintLintMigrator,
} from '../builders';
import { E2eMigrator } from './e2e.migrator';
import { ProjectMigrator } from './project.migrator';

type SupportedTargets =
  | 'build'
  | 'e2e'
  | 'i18n'
  | 'prerender'
  | 'serve'
  | 'server'
  | 'serveSsr';
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
  prerender: { builders: ['@nguniversal/builders:prerender'] },
  serve: { builders: ['@angular-devkit/build-angular:dev-server'] },
  server: { builders: ['@angular-devkit/build-angular:server'] },
  serveSsr: { builders: ['@nguniversal/builders:ssr-dev-server'] },
};

// TODO(leo): this will replace `supportedTargets` once the full refactor is done.
const supportedBuilderMigrators: BuilderMigratorClassType[] = [
  AngularDevkitKarmaMigrator,
  AngularEslintLintMigrator,
];

export class AppMigrator extends ProjectMigrator<SupportedTargets> {
  private e2eMigrator: E2eMigrator;

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
      'apps',
      logger,
      supportedBuilderMigrators
    );

    const eslintBuilderMigrator =
      this.builderMigrators[
        supportedBuilderMigrators.indexOf(AngularEslintLintMigrator)
      ];
    this.e2eMigrator = new E2eMigrator(
      tree,
      options,
      project,
      eslintBuilderMigrator.targets.size
        ? Object.keys(eslintBuilderMigrator.targets)[0]
        : undefined
    );
  }

  override async migrate(): Promise<void> {
    if (this.skipMigration === true) {
      return;
    }

    await super.migrate();

    this.updateProjectConfiguration();

    await this.e2eMigrator.migrate();

    this.moveProjectFiles();
    this.updateProjectConfigurationTargets();

    for (const builderMigrator of this.builderMigrators ?? []) {
      await builderMigrator.migrate();
    }

    this.updateTsConfigs();
    this.setCacheableOperations();
  }

  override validate(): ValidationResult {
    const errors: ValidationResult = [
      ...(super.validate() ?? []),
      ...(this.e2eMigrator.validate() ?? []),
    ];

    for (const builderMigrator of this.builderMigrators) {
      errors.push(...(builderMigrator.validate() ?? []));
    }

    return errors.length ? errors : null;
  }

  private moveProjectFiles(): void {
    // project is self-contained and can be safely moved
    if (this.project.oldRoot !== '') {
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

    if (this.targetNames.server) {
      this.moveFilePathsFromTargetToProjectRoot(
        this.projectConfig.targets[this.targetNames.server],
        ['tsConfig']
      );
    }

    this.moveDir(this.project.oldSourceRoot, this.project.newSourceRoot);
  }

  private setCacheableOperations(): void {
    const toCache = [];
    if (
      this.targetNames.build &&
      !this.shouldSkipTargetTypeMigration('build')
    ) {
      toCache.push(this.targetNames.build);
    }
    if (this.targetNames.e2e && !this.shouldSkipTargetTypeMigration('e2e')) {
      toCache.push(this.targetNames.e2e);
    }

    if (toCache.length) {
      this.updateCacheableOperations(toCache);
    }
  }

  private updateProjectConfiguration(): void {
    convertToNxProject(this.tree, this.project.name);
    this.moveFile(
      joinPathFragments(this.project.oldRoot, 'project.json'),
      joinPathFragments(this.project.newRoot, 'project.json')
    );

    this.projectConfig.root = this.project.newRoot;
    this.projectConfig.sourceRoot = this.project.newSourceRoot;

    updateProjectConfiguration(this.tree, this.project.name, {
      ...this.projectConfig,
    });
  }

  private updateProjectConfigurationTargets(): void {
    if (
      !this.projectConfig.targets ||
      !Object.keys(this.projectConfig.targets).length
    ) {
      this.logger.warn(
        'The project does not have any targets configured. Skipping updating targets.'
      );
      return;
    }

    this.updateBuildTargetConfiguration();
    this.updateServerTargetConfiguration();
    this.updatePrerenderTargetConfiguration();
    this.updateServeSsrTargetConfiguration();

    updateProjectConfiguration(this.tree, this.project.name, {
      ...this.projectConfig,
    });
  }

  private updateTsConfigs(): void {
    const rootTsConfigFile = getRootTsConfigPathInTree(this.tree);
    const projectOffsetFromRoot = offsetFromRoot(this.projectConfig.root);

    this.updateTsConfigFileUsedByBuildTarget(
      rootTsConfigFile,
      projectOffsetFromRoot
    );
    this.updateTsConfigFileUsedByServerTarget(projectOffsetFromRoot);
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
      buildOptions.polyfills &&
      (Array.isArray(buildOptions.polyfills)
        ? buildOptions.polyfills.map((asset) => this.convertAsset(asset))
        : this.convertAsset(buildOptions.polyfills as string));
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

  private updateBuildTargetConfiguration(): void {
    if (!this.targetNames.build) {
      this.logger.warn(
        'There is no build target in the project configuration. Skipping updating the build target configuration.'
      );
      return;
    }

    if (this.shouldSkipTargetTypeMigration('build')) {
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
    } else {
      const newBuildDevTsConfig = this.convertPath(buildDevTsConfig);
      if (!this.tree.exists(newBuildDevTsConfig)) {
        this.logger.warn(
          `The tsConfig file "${buildDevTsConfig}" specified in the "${this.targetNames.build}" target could not be found. Skipping updating the tsConfig file.`
        );
      }
    }

    this.convertBuildOptions(buildTarget.options ?? {});
    Object.values(buildTarget.configurations ?? {}).forEach((config) =>
      this.convertBuildOptions(config)
    );
  }

  private updatePrerenderTargetConfiguration(): void {
    if (
      !this.targetNames.prerender ||
      this.shouldSkipTargetTypeMigration('prerender')
    ) {
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
    if (
      !this.targetNames.server ||
      this.shouldSkipTargetTypeMigration('server')
    ) {
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
    } else {
      const newServerDevTsConfig = this.convertPath(serverDevTsConfig);
      if (!this.tree.exists(newServerDevTsConfig)) {
        this.logger.warn(
          `The tsConfig file "${serverDevTsConfig}" specified in the "${this.targetNames.server}" target could not be found. Skipping updating the tsConfig file.`
        );
      }
    }

    this.convertServerOptions(serverTarget.options ?? {});
    Object.values(serverTarget.configurations ?? {}).forEach((config) =>
      this.convertServerOptions(config)
    );
  }

  private updateServeSsrTargetConfiguration(): void {
    if (
      !this.targetNames.serveSsr ||
      this.shouldSkipTargetTypeMigration('serveSsr')
    ) {
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

  private updateTsConfigFileUsedByBuildTarget(
    rootTsConfigFile: string,
    projectOffsetFromRoot: string
  ): void {
    if (
      !this.targetNames.build ||
      this.shouldSkipTargetTypeMigration('build')
    ) {
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
    if (
      !this.targetNames.server ||
      this.shouldSkipTargetTypeMigration('server')
    ) {
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
}
