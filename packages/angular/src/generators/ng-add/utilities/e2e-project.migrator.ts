import {
  addProjectConfiguration,
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  readJson,
  TargetConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { basename, relative } from 'path';
import { GeneratorOptions } from '../schema';
import {
  getCypressConfigFile,
  isCypressE2eProject,
  isProtractorE2eProject,
} from './e2e-utils';
import { ProjectMigrator } from './project.migrator';
import { MigrationProjectConfiguration, ValidationResult } from './types';

export class E2eProjectMigrator extends ProjectMigrator {
  private appConfig: ProjectConfiguration;
  private appName: string;

  constructor(
    tree: Tree,
    options: GeneratorOptions,
    project: MigrationProjectConfiguration
  ) {
    super(tree, options, project, 'apps');

    this.appConfig = project.config;
    this.appName = this.project.name;

    this.initializeProject();
  }

  async migrate(): Promise<void> {
    if (!this.project) {
      console.warn(
        'No e2e project was migrated because there was none declared in angular.json.'
      );
      return;
    }

    if (isProtractorE2eProject(this.projectConfig)) {
      this.migrateProtractorE2eProject();
    } else if (isCypressE2eProject(this.projectConfig)) {
      this.migrateCypressE2eProject();
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
    // TODO: implement validation when multiple apps are supported
    return null;
  }

  private initializeProject(): void {
    if (!this.projectConfig.targets?.e2e) {
      this.project = null;
      return;
    }

    const name = this.project.name.endsWith('-e2e')
      ? this.project.name
      : `${this.project.name}-e2e`;
    const newRoot = joinPathFragments('apps', name);

    if (isProtractorE2eProject(this.projectConfig)) {
      this.project = {
        ...this.project,
        name,
        oldRoot: joinPathFragments(this.project.oldRoot, 'e2e'),
        newRoot,
      };
    } else if (isCypressE2eProject(this.projectConfig)) {
      this.project = {
        ...this.project,
        name,
        oldRoot: 'cypress',
        newRoot,
      };
    }
  }

  private migrateProtractorE2eProject(): void {
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
        lint: {
          executor: '@angular-devkit/build-angular:tslint',
          options: {
            ...this.projectConfig.targets.lint,
            tsConfig: joinPathFragments(this.project.newRoot, 'tsconfig.json'),
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

    // remove e2e target from the app config
    delete this.appConfig.targets.e2e;
    updateProjectConfiguration(this.tree, this.appName, {
      ...this.appConfig,
    });
  }

  private migrateCypressE2eProject(): void {
    const oldCypressConfigFilePath = getCypressConfigFile(this.projectConfig);

    const cypressConfigFilePath = this.updateOrCreateCypressConfigFile(
      oldCypressConfigFilePath
    );

    this.moveFile(
      joinPathFragments(this.project.oldRoot, 'tsconfig.json'),
      joinPathFragments(this.project.newRoot, 'tsconfig.json')
    );
    this.moveDir(
      this.project.oldRoot,
      joinPathFragments(this.project.newRoot, 'src')
    );

    this.updateCypressProjectConfiguration(cypressConfigFilePath);
  }

  private updateOrCreateCypressConfigFile(configFile: string): string {
    let cypressConfigFilePath: string;

    if (configFile) {
      cypressConfigFilePath = joinPathFragments(
        this.project.newRoot,
        basename(configFile)
      );
      this.updateCypressConfigFilePaths(configFile);
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
    this.projectConfig = {
      root: this.project.newRoot,
      sourceRoot: joinPathFragments(this.project.newRoot, 'src'),
      projectType: 'application',
      targets: {
        e2e: this.updateE2eCypressTarget(
          this.projectConfig.targets.e2e,
          cypressConfigPath
        ),
      },
      implicitDependencies: [this.appName],
      tags: [],
    };

    if (this.appConfig.targets['cypress-run']) {
      this.projectConfig.targets['cypress-run'] = this.updateE2eCypressTarget(
        this.appConfig.targets['cypress-run'],
        cypressConfigPath
      );
    }
    if (this.appConfig.targets['cypress-open']) {
      this.projectConfig.targets['cypress-open'] = this.updateE2eCypressTarget(
        this.appConfig.targets['cypress-open'],
        cypressConfigPath
      );
    }

    addProjectConfiguration(
      this.tree,
      this.project.name,
      {
        ...this.projectConfig,
      },
      true
    );

    delete this.appConfig.targets['cypress-run'];
    delete this.appConfig.targets['cypress-open'];
    delete this.appConfig.targets.e2e;
    updateProjectConfiguration(this.tree, this.appName, {
      ...this.appConfig,
    });
  }

  private updateE2eCypressTarget(
    target: TargetConfiguration,
    cypressConfig: string
  ): TargetConfiguration {
    const updatedTarget = {
      ...target,
      executor: '@nrwl/cypress:cypress',
      options: {
        ...target.options,
        cypressConfig,
      },
    };
    delete updatedTarget.options.configFile;
    delete updatedTarget.options.tsConfig;

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
}
