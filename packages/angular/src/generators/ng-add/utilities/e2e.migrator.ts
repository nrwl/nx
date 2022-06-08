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
import { Logger } from './logger';
import { ProjectMigrator } from './project.migrator';
import {
  MigrationProjectConfiguration,
  Target,
  ValidationResult,
} from './types';

type SupportedTargets = 'e2e';
const supportedTargets: Record<SupportedTargets, Target> = {
  e2e: {
    acceptMultipleDefinitions: true,
    builders: [
      '@angular-devkit/build-angular:protractor',
      '@cypress/schematic:cypress',
    ],
  },
};

export class E2eMigrator extends ProjectMigrator<SupportedTargets> {
  private appConfig: ProjectConfiguration;
  private appName: string;
  private isProjectUsingEsLint: boolean;

  constructor(
    tree: Tree,
    options: GeneratorOptions,
    project: MigrationProjectConfiguration,
    private lintTargetName: string | undefined,
    logger?: Logger
  ) {
    super(tree, options, supportedTargets, project, 'apps', logger);

    this.appConfig = project.config;
    this.appName = this.project.name;

    // TODO(leo): temporary keep restriction to support projects with an "e2e" target,
    // will be lifted soon when the migration is split per-builder and proper support
    // for multiple targets for the same builder is added
    this.targetNames.e2e = this.appConfig.targets?.e2e ? 'e2e' : undefined;

    this.initialize();
  }

  async migrate(): Promise<void> {
    if (!this.targetNames.e2e) {
      this.logger.info(
        'No e2e project was migrated because there was no "e2e" target declared in the "angular.json".'
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
    if (!this.tree.exists(tsConfig)) {
      this.logger.warn(
        'A "tsconfig.json" file could not be found for the e2e project. Skipping updating the tsConfig file.'
      );
      return;
    }

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

  override validate(): ValidationResult {
    if (!this.targetNames.e2e) {
      return null;
    }

    const e2eTarget = this.projectConfig.targets[this.targetNames.e2e];
    if (!e2eTarget.options) {
      return [
        {
          message: `The "${this.targetNames.e2e}" target is not specifying any options.`,
          hint:
            `Make sure the "${this.appName}.architect.e2e.options" is correctly set ` +
            `or remove the "${this.appName}.architect.e2e" target if it is not valid.`,
        },
      ];
    }

    if (this.isProtractorE2eProject()) {
      if (!e2eTarget.options.protractorConfig) {
        return [
          {
            message:
              'The "e2e" target is using the "@angular-devkit/build-angular:protractor" builder but the Protractor config file is not specified.',
            hint:
              `Make sure the "${this.appName}.architect.e2e.options.protractorConfig" is correctly set ` +
              `or remove the "${this.appName}.architect.e2e" target if it is not valid.`,
          },
        ];
      }

      if (!this.tree.exists(e2eTarget.options.protractorConfig)) {
        return [
          {
            message: `The specified Protractor config file "${e2eTarget.options.protractorConfig}" in the "e2e" target could not be found.`,
            hint:
              `Make sure the "${this.appName}.architect.e2e.options.protractorConfig" is set to a valid path ` +
              `or remove the "${this.appName}.architect.e2e" target if it is not valid.`,
          },
        ];
      }

      return null;
    }

    if (this.isCypressE2eProject()) {
      const configFile =
        this.projectConfig.targets[this.targetNames.e2e].options?.configFile;
      if (
        configFile === undefined &&
        !this.tree.exists(
          joinPathFragments(this.project.oldRoot, 'cypress.json')
        )
      ) {
        return [
          {
            message:
              `The "e2e" target is using the "@cypress/schematic:cypress" builder but the "configFile" option is not specified ` +
              `and a "cypress.json" file could not be found at the project root.`,
            hint:
              `Make sure the "${this.appName}.architect.e2e.options.configFile" option is set to a valid path, ` +
              `or that a "cypress.json" file exists at the project root, ` +
              `or remove the "${this.appName}.architect.e2e" target if it is not valid.`,
          },
        ];
      } else if (configFile && !this.tree.exists(configFile)) {
        return [
          {
            message: `The specified Cypress config file "${configFile}" in the "e2e" target could not be found.`,
            hint:
              `Make sure the "${this.appName}.architect.e2e.options.configFile" option is set to a valid path ` +
              `or remove the "${this.appName}.architect.e2e" target if it is not valid.`,
          },
        ];
      }

      if (
        !this.tree.exists(joinPathFragments(this.project.oldRoot, 'cypress'))
      ) {
        return [
          {
            message: `The "e2e" target is using the "@cypress/schematic:cypress" builder but the "cypress" directory could not be found at the project root.`,
            hint: 'Make sure the "cypress" directory exists in the project root or remove the "e2e" target if it is not valid.',
          },
        ];
      }

      return null;
    }

    return null;
  }

  private initialize(): void {
    if (!this.targetNames.e2e) {
      return;
    }

    this.isProjectUsingEsLint =
      Boolean(this.lintTargetName) ||
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
        oldSourceRoot: joinPathFragments(this.project.oldRoot, 'cypress'),
        newRoot,
        newSourceRoot,
      };
    }
  }

  private async migrateProtractorE2eProject(): Promise<void> {
    this.moveDir(this.project.oldRoot, this.project.newRoot);

    this.projectConfig = {
      root: this.project.newRoot,
      sourceRoot: this.project.newSourceRoot,
      projectType: 'application',
      targets: {
        e2e: {
          ...this.projectConfig.targets[this.targetNames.e2e],
          options: {
            ...this.projectConfig.targets[this.targetNames.e2e].options,
            protractorConfig: this.convertRootPath(
              this.projectConfig.targets[this.targetNames.e2e].options
                .protractorConfig
            ),
          },
        },
      },
      implicitDependencies: [this.appName],
      tags: [],
    };

    // remove e2e target from the app config
    delete this.appConfig.targets[this.targetNames.e2e];
    updateProjectConfiguration(this.tree, this.appName, {
      ...this.appConfig,
    });

    // add e2e project config
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
      joinPathFragments(this.project.oldSourceRoot, 'tsconfig.json'),
      newTsConfigPath
    );

    // replace the generated source with the project source
    visitNotIgnoredFiles(this.tree, this.project.newSourceRoot, (filePath) => {
      this.tree.delete(filePath);
    });
    this.moveDir(
      this.project.oldSourceRoot,
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
      writeJson(this.tree, cypressConfigFilePath, {
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
      });
    }

    return cypressConfigFilePath;
  }

  private updateCypressProjectConfiguration(cypressConfigPath: string): void {
    /**
     * The `cypressProjectGenerator` function normalizes the project name. The
     * migration keeps the names for existing projects as-is to avoid any
     * confusion. The e2e project is technically new, but it's associated
     * to an existing application, so we keep it familiar.
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
      // the generated cypress project always generates a "lint" target,
      // in case the app was using a different name for it, we use it
      const lintTarget = this.projectConfig.targets.lint;
      if (this.lintTargetName && this.lintTargetName !== 'lint') {
        this.projectConfig.targets[this.lintTargetName] =
          this.projectConfig.targets.lint;
      }
      lintTarget.options.lintFilePatterns =
        lintTarget.options.lintFilePatterns.map((pattern) =>
          pattern.replace(`apps/${generatedProjectName}`, this.project.newRoot)
        );
    }

    [this.targetNames.e2e, 'cypress-run', 'cypress-open'].forEach((target) => {
      if (this.appConfig.targets[target]) {
        this.projectConfig.targets[target] = this.updateE2eCypressTarget(
          this.appConfig.targets[target],
          cypressConfigPath
        );
      }
    });

    updateProjectConfiguration(this.tree, this.project.name, {
      ...this.projectConfig,
    });

    delete this.appConfig.targets['cypress-run'];
    delete this.appConfig.targets['cypress-open'];
    delete this.appConfig.targets[this.targetNames.e2e];
    updateProjectConfiguration(this.tree, this.appName, {
      ...this.appConfig,
    });
  }

  private updateE2eCypressTarget(
    existingTarget: TargetConfiguration,
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
    if (updatedTarget.options.tsConfig) {
      updatedTarget.options.tsConfig = joinPathFragments(
        this.project.newRoot,
        'tsconfig.json'
      );
    } else {
      delete updatedTarget.options.tsConfig;
    }

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
          this.project.oldSourceRoot,
          cypressConfig[folderOrFile]
        )}`;
      }
    });

    distFolders.forEach((folder) => {
      if (cypressConfig[folder]) {
        cypressConfig[folder] = `../../dist/cypress/${
          this.project.newRoot
        }/${relative(this.project.oldSourceRoot, cypressConfig[folder])}`;
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
      new RegExp(`^(\\.\\/|\\/)?${this.project.oldSourceRoot}\\/`),
      './src/'
    );
  }

  private getCypressConfigFile(): string | undefined {
    let cypressConfig = joinPathFragments(this.project.oldRoot, 'cypress.json');
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
      this.projectConfig.targets[this.targetNames.e2e].executor ===
      '@cypress/schematic:cypress'
    );
  }

  private isProtractorE2eProject(): boolean {
    return (
      this.projectConfig.targets[this.targetNames.e2e].executor ===
      '@angular-devkit/build-angular:protractor'
    );
  }
}
