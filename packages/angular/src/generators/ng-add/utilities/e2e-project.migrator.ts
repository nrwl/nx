import { cypressProjectGenerator } from '@nrwl/cypress';
import {
  addProjectConfiguration,
  joinPathFragments,
  names,
  offsetFromRoot,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  removeProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  visitNotIgnoredFiles,
  writeJson,
} from '@nrwl/devkit';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { basename, relative } from 'path';
import { GeneratorOptions } from '../schema';
import { ProjectMigrator } from './project.migrator';
import { MigrationProjectConfiguration, ValidationResult } from './types';

export class E2eProjectMigrator extends ProjectMigrator {
  private appConfig: ProjectConfiguration;
  private appName: string;
  private isProjectUsingEsLint: boolean;

  constructor(
    tree: Tree,
    options: GeneratorOptions,
    project: MigrationProjectConfiguration
  ) {
    super(tree, options, project, 'apps');

    this.appConfig = project.config;
    this.appName = this.project.name;

    this.initialize();
  }

  async migrate(): Promise<void> {
    if (!this.project) {
      this.logger.warn(
        'No e2e project was migrated because there was none declared in angular.json.'
      );
      return;
    }

    if (this.isProtractorE2eProject()) {
      await this.migrateProtractorE2eProject();
    } else if (this.isCypressE2eProject()) {
      await this.migrateCypressE2eProject();
    }

    const tsConfig = joinPathFragments(
      this.projectConfig.root,
      'tsconfig.json'
    );
    const rootOffset = offsetFromRoot(this.project.newRoot);
    updateJson(this.tree, tsConfig, (json) => {
      json.extends = `${rootOffset}${getRootTsConfigPathInTree(this.tree)}`;
      json.compilerOptions = {
        ...json.compilerOptions,
        outDir: `${rootOffset}dist/out-tsc`,
      };
      return json;
    });
  }

  validate(): ValidationResult {
    if (!this.project) {
      return null;
    }

    if (this.isProtractorE2eProject()) {
      if (
        this.tree.exists(
          this.projectConfig.targets.e2e.options.protractorConfig
        )
      ) {
        return;
      }

      return (
        `An e2e project with Protractor was found but "${this.projectConfig.targets.e2e.options.protractorConfig}" could not be found.\n` +
        `Make sure the "${this.appName}.architect.e2e.options.protractorConfig" is valid or the "${this.appName}" project is removed from "angular.json".`
      );
    } else if (this.isCypressE2eProject()) {
      const configFile = this.getCypressConfigFile();
      if (configFile && !this.tree.exists(configFile)) {
        return `An e2e project with Cypress was found but "${configFile}" could not be found.`;
      }

      if (!this.tree.exists('cypress')) {
        return `An e2e project with Cypress was found but the "cypress" directory could not be found.`;
      }
    } else {
      return `An e2e project was found but it's using an unsupported executor "${this.projectConfig.targets.e2e.executor}".`;
    }

    return null;
  }

  private initialize(): void {
    if (!this.projectConfig.targets?.e2e) {
      this.project = null;
      return;
    }

    this.isProjectUsingEsLint =
      Boolean(this.appConfig.targets.lint) ||
      this.tree.exists(
        joinPathFragments(this.appConfig.root, '.eslintrc.json')
      );

    const name = this.project.name.endsWith('-e2e')
      ? this.project.name
      : `${this.project.name}-e2e`;
    const newRoot = joinPathFragments('apps', name);
    const newSourceRoot = joinPathFragments('apps', name, 'src');

    if (this.isProtractorE2eProject()) {
      this.project = {
        ...this.project,
        name,
        oldRoot: joinPathFragments(this.project.oldRoot, 'e2e'),
        newRoot,
        newSourceRoot,
      };
    } else if (this.isCypressE2eProject()) {
      this.project = {
        ...this.project,
        name,
        oldRoot: 'cypress',
        newRoot,
        newSourceRoot,
      };
    }
  }

  private async migrateProtractorE2eProject(): Promise<void> {
    this.moveDir(this.project.oldRoot, this.project.newRoot);

    this.projectConfig = {
      root: this.project.newRoot,
      projectType: 'application',
      targets: {
        e2e: {
          ...this.projectConfig.targets.e2e,
          options: {
            ...this.projectConfig.targets.e2e.options,
            protractorConfig: joinPathFragments(
              this.project.newRoot,
              'protractor.conf.js'
            ),
          },
        },
      },
      implicitDependencies: [this.appName],
      tags: [],
    };
    addProjectConfiguration(
      this.tree,
      this.project.name,
      {
        ...this.projectConfig,
      },
      true
    );

    if (this.isProjectUsingEsLint) {
      await lintProjectGenerator(this.tree, {
        project: this.project.name,
        linter: Linter.EsLint,
        eslintFilePatterns: [`${this.project.newRoot}/**/*.{js,ts}`],
        tsConfigPaths: [
          joinPathFragments(this.project.newRoot, 'tsconfig.json'),
        ],
        skipFormat: true,
      });
    }

    // remove e2e target from the app config
    delete this.appConfig.targets.e2e;
    updateProjectConfiguration(this.tree, this.appName, {
      ...this.appConfig,
    });
  }

  private async migrateCypressE2eProject(): Promise<void> {
    const oldCypressConfigFilePath = this.getCypressConfigFile();

    await cypressProjectGenerator(this.tree, {
      name: this.project.name,
      project: this.appName,
      linter: this.isProjectUsingEsLint ? Linter.EsLint : Linter.None,
      standaloneConfig: true,
      skipFormat: true,
    });

    const cypressConfigFilePath = this.updateOrCreateCypressConfigFile(
      oldCypressConfigFilePath
    );
    this.updateCypressProjectConfiguration(cypressConfigFilePath);

    // replace the generated tsconfig.json with the project one
    const newTsConfigPath = joinPathFragments(
      this.project.newRoot,
      'tsconfig.json'
    );
    this.tree.delete(newTsConfigPath);
    this.moveFile(
      joinPathFragments(this.project.oldRoot, 'tsconfig.json'),
      newTsConfigPath
    );

    // replace the generated source with the project source
    visitNotIgnoredFiles(this.tree, this.project.newSourceRoot, (filePath) => {
      this.tree.delete(filePath);
    });
    this.moveDir(
      this.project.oldRoot,
      joinPathFragments(this.project.newSourceRoot)
    );
  }

  private updateOrCreateCypressConfigFile(configFile: string): string {
    let cypressConfigFilePath: string;

    if (configFile) {
      cypressConfigFilePath = joinPathFragments(
        this.project.newRoot,
        basename(configFile)
      );
      this.updateCypressConfigFilePaths(configFile);
      this.tree.delete(cypressConfigFilePath);
      this.moveFile(configFile, cypressConfigFilePath);
    } else {
      cypressConfigFilePath = joinPathFragments(
        this.project.newRoot,
        'cypress.json'
      );
      this.tree.write(
        cypressConfigFilePath,
        JSON.stringify({
          fileServerFolder: '.',
          fixturesFolder: './src/fixtures',
          integrationFolder: './src/integration',
          modifyObstructiveCode: false,
          supportFile: './src/support/index.ts',
          pluginsFile: './src/plugins/index.ts',
          video: true,
          videosFolder: `../../dist/cypress/${this.project.newRoot}/videos`,
          screenshotsFolder: `../../dist/cypress/${this.project.newRoot}/screenshots`,
          chromeWebSecurity: false,
        })
      );
    }

    return cypressConfigFilePath;
  }

  private updateCypressProjectConfiguration(cypressConfigPath: string): void {
    /**
     * The `cypressProjectGenerator` function normalizes the project name. The
     * migration keeps the names for existing projects as-is to avoid any
     * confusion. The e2e project is technically new, but it's associated
     * to an existing application.
     */
    const generatedProjectName = names(this.project.name).fileName;
    if (this.project.name !== generatedProjectName) {
      // If the names are different, we "rename" the newly added project.
      this.projectConfig = readProjectConfiguration(
        this.tree,
        generatedProjectName
      );

      this.projectConfig.root = this.project.newRoot;
      this.projectConfig.sourceRoot = this.project.newSourceRoot;
      removeProjectConfiguration(this.tree, generatedProjectName);
      addProjectConfiguration(
        this.tree,
        this.project.name,
        { ...this.projectConfig },
        true
      );
    } else {
      this.projectConfig = readProjectConfiguration(
        this.tree,
        this.project.name
      );
    }

    if (this.isProjectUsingEsLint) {
      this.projectConfig.targets.lint.options.lintFilePatterns =
        this.projectConfig.targets.lint.options.lintFilePatterns.map(
          (pattern) =>
            pattern.replace(
              `apps/${generatedProjectName}`,
              this.project.newRoot
            )
        );
    }

    ['e2e', 'cypress-run', 'cypress-open'].forEach((target) => {
      if (this.appConfig.targets[target]) {
        this.projectConfig.targets[target] = this.updateE2eCypressTarget(
          this.appConfig.targets[target],
          this.projectConfig.targets[target],
          cypressConfigPath
        );
      }
    });

    updateProjectConfiguration(this.tree, this.project.name, {
      ...this.projectConfig,
    });

    delete this.appConfig.targets['cypress-run'];
    delete this.appConfig.targets['cypress-open'];
    delete this.appConfig.targets.e2e;
    updateProjectConfiguration(this.tree, this.appName, {
      ...this.appConfig,
    });
  }

  private updateE2eCypressTarget(
    existingTarget: TargetConfiguration,
    generatedTarget: TargetConfiguration,
    cypressConfig: string
  ): TargetConfiguration {
    const updatedTarget = {
      ...existingTarget,
      executor: '@nrwl/cypress:cypress',
      options: {
        ...existingTarget.options,
        cypressConfig,
      },
    };
    delete updatedTarget.options.configFile;
    if (
      generatedTarget &&
      !generatedTarget.options.tsConfig &&
      updatedTarget.options.tsConfig
    ) {
      // if what we generate doesn't have a tsConfig, we don't need it
      delete updatedTarget.options.tsConfig;
    } else if (updatedTarget.options.tsConfig) {
      updatedTarget.options.tsConfig = joinPathFragments(
        this.project.newRoot,
        'tsconfig.json'
      );
    }

    if (updatedTarget.options.headless && updatedTarget.options.watch) {
      updatedTarget.options.headed = false;
    } else if (
      updatedTarget.options.headless === false &&
      !updatedTarget.options.watch
    ) {
      updatedTarget.options.headed = true;
    }
    delete updatedTarget.options.headless;

    return updatedTarget;
  }

  private updateCypressConfigFilePaths(configFilePath: string): void {
    const srcFoldersAndFiles = [
      'integrationFolder',
      'supportFile',
      'pluginsFile',
      'fixturesFolder',
    ];
    const distFolders = ['videosFolder', 'screenshotsFolder'];
    const stringOrArrayGlobs = ['ignoreTestFiles', 'testFiles'];

    const cypressConfig = readJson(this.tree, configFilePath);

    cypressConfig.fileServerFolder = '.';
    srcFoldersAndFiles.forEach((folderOrFile) => {
      if (cypressConfig[folderOrFile]) {
        cypressConfig[folderOrFile] = `./src/${relative(
          this.project.oldRoot,
          cypressConfig[folderOrFile]
        )}`;
      }
    });

    distFolders.forEach((folder) => {
      if (cypressConfig[folder]) {
        cypressConfig[folder] = `../../dist/cypress/${
          this.project.newRoot
        }/${relative(this.project.oldRoot, cypressConfig[folder])}`;
      }
    });

    stringOrArrayGlobs.forEach((stringOrArrayGlob) => {
      if (!cypressConfig[stringOrArrayGlob]) {
        return;
      }

      if (Array.isArray(cypressConfig[stringOrArrayGlob])) {
        cypressConfig[stringOrArrayGlob] = cypressConfig[stringOrArrayGlob].map(
          (glob: string) => this.replaceCypressGlobConfig(glob)
        );
      } else {
        cypressConfig[stringOrArrayGlob] = this.replaceCypressGlobConfig(
          cypressConfig[stringOrArrayGlob]
        );
      }
    });

    writeJson(this.tree, configFilePath, cypressConfig);
  }

  private replaceCypressGlobConfig(globPattern: string): string {
    return globPattern.replace(
      new RegExp(`^(\\.\\/|\\/)?${this.project.oldRoot}\\/`),
      './src/'
    );
  }

  private getCypressConfigFile(): string | undefined {
    let cypressConfig = 'cypress.json';
    const configFileOption = this.projectConfig.targets.e2e.options.configFile;
    if (configFileOption === false) {
      cypressConfig = undefined;
    } else if (typeof configFileOption === 'string') {
      cypressConfig = basename(configFileOption);
    }

    return cypressConfig;
  }

  private isCypressE2eProject(): boolean {
    return (
      this.projectConfig.targets.e2e.executor === '@cypress/schematic:cypress'
    );
  }

  private isProtractorE2eProject(): boolean {
    return (
      this.projectConfig.targets.e2e.executor ===
      '@angular-devkit/build-angular:protractor'
    );
  }
}
