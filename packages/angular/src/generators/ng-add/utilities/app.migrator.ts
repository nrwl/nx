import {
  joinPathFragments,
  offsetFromRoot,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { convertToNxProjectGenerator } from '@nrwl/workspace/generators';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { GeneratorOptions } from '../schema';
import { E2eProjectMigrator } from './e2e-project.migrator';
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
    // TODO: check later if it's still needed
    this.updateProjectTsLint();
  }

  validate(): ValidationResult {
    // TODO: implement validation when multiple apps are supported
    return null;
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

    this.moveProjectRootFile(this.projectConfig.targets.build.options.tsConfig);

    if (this.projectConfig.targets.test) {
      this.moveProjectRootFile(
        this.projectConfig.targets.test.options.karmaConfig
      );
      this.moveProjectRootFile(
        this.projectConfig.targets.test.options.tsConfig
      );
    } else {
      // there could still be a karma.conf.js file in the root
      // so move to new location
      if (this.tree.exists('karma.conf.js')) {
        console.info('No test configuration, but root Karma config file found');
        this.moveProjectRootFile('karma.conf.js');
      }
    }

    if (this.projectConfig.targets.server) {
      this.moveProjectRootFile(
        this.projectConfig.targets.server.options.tsConfig
      );
    }

    this.moveDir(this.project.oldSourceRoot, this.project.newSourceRoot);
  }

  private async updateProjectConfiguration(): Promise<void> {
    this.projectConfig.root = this.project.newRoot;
    this.projectConfig.sourceRoot = this.project.newSourceRoot;

    this.convertBuildOptions(this.projectConfig.targets.build.options);
    Object.values(this.projectConfig.targets.build.configurations).forEach(
      (config) => this.convertBuildOptions(config)
    );

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
      this.projectConfig.targets.lint.options.tsConfig = [
        joinPathFragments(this.project.newRoot, 'tsconfig.app.json'),
        joinPathFragments(this.project.newRoot, 'tsconfig.spec.json'),
      ];
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
    const tsConfigPath = getRootTsConfigPathInTree(this.tree);
    const projectOffsetFromRoot = offsetFromRoot(this.projectConfig.root);

    updateJson(
      this.tree,
      this.projectConfig.targets.build.options.tsConfig,
      (json) => {
        json.extends = `${projectOffsetFromRoot}${tsConfigPath}`;
        json.compilerOptions = json.compilerOptions || {};
        json.compilerOptions.outDir = `${projectOffsetFromRoot}dist/out-tsc`;
        return json;
      }
    );

    if (this.projectConfig.targets.test) {
      updateJson(
        this.tree,
        this.projectConfig.targets.test.options.tsConfig,
        (json) => {
          json.extends = `${projectOffsetFromRoot}${tsConfigPath}`;
          json.compilerOptions = json.compilerOptions ?? {};
          json.compilerOptions.outDir = `${projectOffsetFromRoot}dist/out-tsc`;
          return json;
        }
      );
    }

    if (this.projectConfig.targets.server) {
      updateJson(
        this.tree,
        this.projectConfig.targets.server.options.tsConfig,
        (json) => {
          json.extends = `${projectOffsetFromRoot}${tsConfigPath}`;
          json.compilerOptions = json.compilerOptions ?? {};
          json.compilerOptions.outDir = `${projectOffsetFromRoot}dist/out-tsc`;
          return json;
        }
      );
    }
  }

  private updateProjectTsLint(): void {
    if (this.tree.exists(`${this.project.newRoot}/tslint.json`)) {
      updateJson(this.tree, `${this.project.newRoot}/tslint.json`, (json) => {
        json.extends = '../../tslint.json';
        return json;
      });
    }
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

  private convertAsset(asset: string | any): string | any {
    if (typeof asset === 'string') {
      return this.convertPath(asset);
    } else {
      return { ...asset, input: this.convertPath(asset.input) };
    }
  }

  private convertPath(originalPath: string): string {
    return originalPath?.startsWith(this.project.oldSourceRoot)
      ? joinPathFragments(
          this.project.newSourceRoot,
          originalPath.replace(this.project.oldSourceRoot, '')
        )
      : originalPath;
  }
}
