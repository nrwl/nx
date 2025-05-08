import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import {
  addProjectConfiguration,
  ensurePackage,
  joinPathFragments,
  offsetFromRoot,
  readJson,
  readNxJson,
  readProjectConfiguration,
  stripIndents,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { lintProjectGenerator } from '@nx/eslint';
import { getRootTsConfigPathInTree, insertImport } from '@nx/js';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { basename, relative } from 'path';
import type {
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
} from 'typescript';
import { FileChangeRecorder } from '../../../../utils/file-change-recorder';
import { nxVersion } from '../../../../utils/versions';
import type { GeneratorOptions } from '../../schema';
import type {
  Logger,
  MigrationProjectConfiguration,
  Target,
  ValidationResult,
} from '../../utilities';
import { ProjectMigrator } from './project.migrator';

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

type CypressCommonConfig = {
  fixturesFolder?: string;
  screenshotsFolder?: string;
  specPattern?: string;
  videosFolder?: string;
};

const cypressConfig = {
  v9OrLess: {
    srcPaths: ['supportFile', 'supportFolder', 'fixturesFolder'],
    distPaths: ['videosFolder', 'screenshotsFolder', 'downloadsFolder'],
    globPatterns: ['excludeSpecPattern', 'specPattern'],
  },
  v10OrMore: {
    srcPaths: ['supportFile', 'supportFolder', 'fixturesFolder'],
    distPaths: ['videosFolder', 'screenshotsFolder', 'downloadsFolder'],
    globPatterns: ['excludeSpecPattern', 'specPattern'],
  },
};

export class E2eMigrator extends ProjectMigrator<SupportedTargets> {
  private appConfig: ProjectConfiguration;
  private appName: string;
  private isProjectUsingEsLint: boolean;
  private cypressInstalledVersion: number;
  private cypressPreset: Record<string, any>;

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

  override async migrate(): Promise<void> {
    if (!this.targetNames.e2e) {
      this.logger.info(
        'No e2e project was migrated because there was no "e2e" target declared in the "angular.json".'
      );
      return;
    }

    if (this.shouldSkipTargetTypeMigration('e2e')) {
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
          message: `The "${this.targetNames.e2e}" target is not specifying any options. The target will be skipped.`,
          hint:
            `Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could ` +
            `revert the migration, ensure the "${this.appName}.architect.e2e.options" is correctly set or remove the target if ` +
            `it is not valid, and run the migration again.`,
        },
      ];
    }

    if (this.isProtractorE2eProject()) {
      if (!e2eTarget.options.protractorConfig) {
        return [
          {
            message:
              'The "e2e" target is using the "@angular-devkit/build-angular:protractor" builder but the Protractor config file is not specified. The target will be skipped.',
            hint:
              `Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could ` +
              `revert the migration, ensure the "${this.appName}.architect.e2e.options.protractorConfig" is correctly set ` +
              `or remove the "${this.appName}.architect.e2e" target if it is not valid, and run the migration again.`,
          },
        ];
      }

      if (!this.tree.exists(e2eTarget.options.protractorConfig)) {
        return [
          {
            message: `The specified Protractor config file "${e2eTarget.options.protractorConfig}" in the "e2e" target could not be found. The target will be skipped.`,
            hint:
              `Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could ` +
              `revert the migration, ensure the "${this.appName}.architect.e2e.options.protractorConfig" is set to a valid path ` +
              `or remove the "${this.appName}.architect.e2e" target if it is not valid, and run the migration again.`,
          },
        ];
      }

      return null;
    }

    if (this.isCypressE2eProject()) {
      const configFile =
        this.projectConfig.targets[this.targetNames.e2e].options?.configFile;
      if (configFile === undefined && !this.getOldCypressConfigFilePath()) {
        const expectedConfigFile =
          this.cypressInstalledVersion < 10
            ? 'cypress.json'
            : 'cypress.config.{ts,js,mjs,cjs}';

        return [
          {
            message:
              `The "e2e" target is using the "@cypress/schematic:cypress" builder but the "configFile" option is not specified ` +
              `and a "${expectedConfigFile}" file could not be found at the project root. The target will be skipped.`,
            hint:
              `Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could ` +
              `revert the migration, ensure the "${this.appName}.architect.e2e.options.configFile" option is set to a valid path ` +
              `or that a "${expectedConfigFile}" file exists at the project root or remove the "${this.appName}.architect.e2e" target ` +
              `if it is not valid, and run the migration again.`,
          },
        ];
      } else if (configFile && !this.tree.exists(configFile)) {
        return [
          {
            message: `The specified Cypress config file "${configFile}" in the "e2e" target could not be found. The target will be skipped.`,
            hint:
              `Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could ` +
              `revert the migration, ensure the "${this.appName}.architect.e2e.options.configFile" option is set to a valid path ` +
              `or remove the "${this.appName}.architect.e2e" target if it is not valid, and run the migration again.`,
          },
        ];
      }

      if (
        !this.tree.exists(joinPathFragments(this.project.oldRoot, 'cypress'))
      ) {
        return [
          {
            message: `The "e2e" target is using the "@cypress/schematic:cypress" builder but the "cypress" directory could not be found at the project root. The target will be skipped.`,
            hint:
              `Make sure to manually migrate the target configuration and any possible associated files. Alternatively, you could ` +
              `revert the migration, ensure the "cypress" directory exists in the project root or remove the "e2e" target if it is not ` +
              `valid, and run the migration again.`,
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
      ensurePackage('@nx/cypress', nxVersion);
      const {
        getInstalledCypressMajorVersion,
      } = require('@nx/cypress/src/utils/versions');
      this.cypressInstalledVersion = getInstalledCypressMajorVersion(this.tree);
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
        linter: 'eslint',
        unitTestRunner: this.options.unitTestRunner,
        tsConfigPaths: [
          joinPathFragments(this.project.newRoot, 'tsconfig.json'),
        ],
        skipFormat: true,
      });
    }
  }

  private async migrateCypressE2eProject(): Promise<void> {
    const oldCypressConfigFilePath = this.getOldCypressConfigFilePath();

    addProjectConfiguration(this.tree, this.project.name, {
      projectType: 'application',
      root: this.project.newRoot,
      sourceRoot: this.project.newSourceRoot,
      targets: {},
      tags: [],
      implicitDependencies: [this.appName],
    });
    const nxJson = readNxJson(this.tree) ?? {};
    const addPlugin =
      process.env.NX_ADD_PLUGINS !== 'false' &&
      nxJson.useInferencePlugins !== false;
    const { configurationGenerator } = <typeof import('@nx/cypress')>(
      require('@nx/cypress')
    );
    await configurationGenerator(this.tree, {
      project: this.project.name,
      linter: this.isProjectUsingEsLint ? 'eslint' : 'none',
      skipFormat: true,
      // any target would do, we replace it later with the target existing in the project being migrated
      devServerTarget: `${this.appName}:serve`,
      baseUrl: 'http://localhost:4200',
      addPlugin,
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
    this.visitFiles(this.project.newSourceRoot, (filePath) => {
      this.tree.delete(filePath);
    });
    this.moveDir(
      this.project.oldSourceRoot,
      joinPathFragments(this.project.newSourceRoot)
    );
  }

  private updateOrCreateCypressConfigFile(configFile: string): string {
    if (!configFile) {
      return this.getDefaultCypressConfigFilePath();
    }

    const cypressConfigFilePath = joinPathFragments(
      this.project.newRoot,
      basename(configFile)
    );
    this.updateCypressConfigFilePaths(configFile);
    this.tree.delete(cypressConfigFilePath);
    this.moveFile(configFile, cypressConfigFilePath);

    return cypressConfigFilePath;
  }

  private updateCypressProjectConfiguration(cypressConfigPath: string): void {
    this.projectConfig = readProjectConfiguration(this.tree, this.project.name);

    if (this.isProjectUsingEsLint) {
      // the generated cypress project always generates a "lint" target,
      // in case the app was using a different name for it, we use it
      if (this.lintTargetName && this.lintTargetName !== 'lint') {
        this.projectConfig.targets[this.lintTargetName] =
          this.projectConfig.targets.lint;
      }
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
      executor: '@nx/cypress:cypress',
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
    if (this.cypressInstalledVersion >= 10) {
      this.updateCypress10ConfigFile(configFilePath);
      return;
    }

    const srcPaths = [
      'integrationFolder',
      'supportFile',
      'pluginsFile',
      'fixturesFolder',
    ];
    const distPaths = ['videosFolder', 'screenshotsFolder'];
    const globPatterns = ['ignoreTestFiles', 'testFiles'];

    const cypressConfig = readJson(this.tree, configFilePath);

    cypressConfig.fileServerFolder = '.';
    srcPaths.forEach((path) => {
      if (cypressConfig[path]) {
        cypressConfig[path] = this.cypressConfigSrcPathToNewPath(
          cypressConfig[path]
        );
      }
    });

    distPaths.forEach((path) => {
      if (cypressConfig[path]) {
        cypressConfig[path] = this.cypressConfigDistPathToNewPath(
          cypressConfig[path]
        );
      }
    });

    globPatterns.forEach((stringOrArrayGlob) => {
      if (!cypressConfig[stringOrArrayGlob]) {
        return;
      }

      if (Array.isArray(cypressConfig[stringOrArrayGlob])) {
        cypressConfig[stringOrArrayGlob] = cypressConfig[stringOrArrayGlob].map(
          (glob: string) => this.cypressConfigGlobToNewGlob(glob)
        );
      } else {
        cypressConfig[stringOrArrayGlob] = this.cypressConfigGlobToNewGlob(
          cypressConfig[stringOrArrayGlob]
        );
      }
    });

    writeJson(this.tree, configFilePath, cypressConfig);
  }

  private cypressConfigGlobToNewGlob(
    globPattern: string | undefined
  ): string | undefined {
    return globPattern
      ? globPattern.replace(
          new RegExp(
            `^(\\.\\/|\\/)?${relative(
              this.project.oldRoot,
              this.project.oldSourceRoot
            )}\\/`
          ),
          'src/'
        )
      : undefined;
  }

  private cypressConfigSrcPathToNewPath(
    path: string | undefined
  ): string | undefined {
    return path
      ? joinPathFragments(
          'src',
          relative(
            this.project.oldSourceRoot,
            joinPathFragments(this.project.oldRoot, path)
          )
        )
      : undefined;
  }

  private cypressConfigDistPathToNewPath(
    path: string | undefined
  ): string | undefined {
    return path
      ? joinPathFragments(
          '../../dist/cypress/',
          this.project.newRoot,
          relative(
            this.project.oldSourceRoot,
            joinPathFragments(this.project.oldRoot, path)
          )
        )
      : undefined;
  }

  private updateCypress10ConfigFile(configFilePath: string): void {
    const { isPropertyAssignment } = ensureTypescript();
    const { tsquery } = require('@phenomnomnominal/tsquery');
    const { nxE2EPreset } = require('@nx/cypress/plugins/cypress-preset');
    this.cypressPreset = nxE2EPreset(configFilePath);

    const fileContent = this.tree.read(configFilePath, 'utf-8');
    let sourceFile = tsquery.ast(fileContent);
    const recorder = new FileChangeRecorder(this.tree, configFilePath);

    const defineConfigExpression = tsquery.query(
      sourceFile,
      'CallExpression:has(Identifier[name=defineConfig]) > ObjectLiteralExpression'
    )[0] as ObjectLiteralExpression;

    if (!defineConfigExpression) {
      this.logger.warn(
        `Could not find a "defineConfig" expression in "${configFilePath}". Skipping updating the Cypress configuration.`
      );
      return;
    }

    let e2eNode: PropertyAssignment;
    let componentNode: PropertyAssignment;
    const globalConfig: CypressCommonConfig = {};
    defineConfigExpression.forEachChild((node: Node) => {
      if (isPropertyAssignment(node) && node.name.getText() === 'component') {
        componentNode = node;
        return;
      }
      if (isPropertyAssignment(node) && node.name.getText() === 'e2e') {
        e2eNode = node;
        return;
      }

      if (isPropertyAssignment(node)) {
        this.updateCypressConfigNodeValue(recorder, node, globalConfig);
      }
    });

    this.updateCypressComponentConfig(componentNode, recorder);
    this.updateCypressE2EConfig(
      configFilePath,
      defineConfigExpression,
      e2eNode,
      recorder,
      globalConfig
    );

    recorder.applyChanges();
  }

  private updateCypressComponentConfig(
    componentNode: PropertyAssignment,
    recorder: FileChangeRecorder
  ): void {
    if (!componentNode) {
      return;
    }

    const { isObjectLiteralExpression, isPropertyAssignment } =
      ensureTypescript();
    if (!isObjectLiteralExpression(componentNode.initializer)) {
      this.logger.warn(
        'The automatic migration only supports having an object literal in the "component" option of the Cypress configuration. ' +
          `The configuration won't be updated. Please make sure to update any paths you may have in the "component" option ` +
          'manually to point to the new location.'
      );
      return;
    }

    componentNode.initializer.properties.forEach((node: Node) => {
      if (isPropertyAssignment(node)) {
        this.updateCypressConfigNodeValue(recorder, node);
      }
    });
  }

  private updateCypressE2EConfig(
    configFilePath: string,
    defineConfigNode: ObjectLiteralExpression,
    e2eNode: PropertyAssignment,
    recorder: FileChangeRecorder,
    { ...globalConfig }: CypressCommonConfig
  ): void {
    ensureTypescript();
    const { tsquery } = require('@phenomnomnominal/tsquery');
    const e2eConfig = {};
    const presetSpreadAssignment = `...nxE2EPreset(__dirname),`;
    if (!e2eNode) {
      // add the e2e node with the preset and properties that need to overwrite
      // the preset
      const e2eAssignment = stripIndents`e2e: {
        ${presetSpreadAssignment}
        ${Object.entries(globalConfig)
          .filter(
            ([key, value]) =>
              !e2eConfig[key] && value !== this.cypressPreset[key]
          )
          .map(([key, value]) => `${key}: '${value}'`)
          .join(',\n')}
      },`;
      recorder.insertRight(defineConfigNode.getStart() + 1, e2eAssignment);
    } else {
      const { isObjectLiteralExpression, isPropertyAssignment } =
        ensureTypescript();
      if (!isObjectLiteralExpression(e2eNode.initializer)) {
        this.logger.warn(
          'The automatic migration only supports having an object literal in the "e2e" option of the Cypress configuration. ' +
            `The configuration won't be updated. Please make sure to update any paths you might have in the "e2e" option ` +
            'manually to point to the new location.'
        );
        return;
      }

      recorder.insertRight(
        e2eNode.initializer.getStart() + 1,
        presetSpreadAssignment
      );

      e2eNode.initializer.properties.forEach((node: Node) => {
        if (!isPropertyAssignment(node)) {
          return;
        }

        let change: {
          type: 'replace' | 'remove' | 'ignore';
          value?: string;
        } = { type: 'ignore' };
        const property = this.normalizeNodeText(node.name.getText());
        const oldValue = this.normalizeNodeText(node.initializer.getText());
        e2eConfig[property] = oldValue;

        const createChange = (newValue: string): typeof change => {
          if (newValue === this.cypressPreset[property]) {
            return { type: 'remove' };
          }

          return { type: 'replace', value: newValue };
        };

        if (
          this.isValidPathLikePropertyWithStringLiteralValue(
            node,
            cypressConfig.v10OrMore.srcPaths
          )
        ) {
          const newValue = this.cypressConfigSrcPathToNewPath(oldValue);
          change = createChange(newValue);
        } else if (
          this.isValidPathLikePropertyWithStringLiteralValue(
            node,
            cypressConfig.v10OrMore.distPaths
          )
        ) {
          const newValue = this.cypressConfigDistPathToNewPath(oldValue);
          change = createChange(newValue);
        } else if (
          this.isValidPathLikePropertyWithStringLiteralValue(
            node,
            cypressConfig.v10OrMore.globPatterns
          )
        ) {
          const newValue = this.cypressConfigGlobToNewGlob(oldValue);
          change = createChange(newValue);
        }

        if (change.type === 'replace') {
          recorder.replace(node.initializer, `'${change.value}'`);
          e2eConfig[property] = change.value;
        } else if (change.type === 'remove') {
          const trailingCommaMatch = recorder.originalContent
            .slice(node.getEnd())
            .match(/^\s*,/);
          if (trailingCommaMatch) {
            recorder.remove(
              node.getFullStart(),
              node.getEnd() + trailingCommaMatch[0].length
            );
          } else {
            recorder.remove(node.getFullStart(), node.getEnd());
          }

          delete e2eConfig[property];
          delete globalConfig[property];
        }
      });

      // add any global config that was present and that would be overwritten
      // by the preset
      Object.entries(globalConfig).forEach(([key, value]) => {
        if (e2eConfig[key] || value === this.cypressPreset[key]) {
          return;
        }

        recorder.insertRight(
          e2eNode.initializer.getStart() + 1,
          `${key}: '${value}',`
        );
      });
    }

    // apply changes so we can apply AST transformations
    recorder.applyChanges();
    const sourceFile = tsquery.ast(recorder.content);
    insertImport(
      this.tree,
      sourceFile,
      configFilePath,
      'nxE2EPreset',
      '@nx/cypress/plugins/cypress-preset'
    );
    // update recorder with the new content from the file
    recorder.setContentToFileContent();
  }

  private updateCypressConfigNodeValue(
    recorder: FileChangeRecorder,
    node: PropertyAssignment,
    configCollected?: CypressCommonConfig
  ): void {
    let newValue: string;
    const oldValue = this.normalizeNodeText(node.initializer.getText());

    if (
      this.isValidPathLikePropertyWithStringLiteralValue(
        node,
        cypressConfig.v10OrMore.srcPaths
      )
    ) {
      newValue = this.cypressConfigSrcPathToNewPath(oldValue);
    } else if (
      this.isValidPathLikePropertyWithStringLiteralValue(
        node,
        cypressConfig.v10OrMore.distPaths
      )
    ) {
      newValue = this.cypressConfigDistPathToNewPath(oldValue);
    } else if (
      this.isValidPathLikePropertyWithStringLiteralValue(
        node,
        cypressConfig.v10OrMore.globPatterns
      )
    ) {
      newValue = this.cypressConfigGlobToNewGlob(oldValue);
    }

    if (newValue) {
      recorder.replace(node.initializer, `'${newValue}'`);

      if (configCollected) {
        configCollected[node.name.getText()] = newValue;
      }
    }
  }

  private isValidPathLikePropertyWithStringLiteralValue(
    node: Node,
    properties: string[]
  ): boolean {
    const {
      isPropertyAssignment,
      isStringLiteralLike,
      isTemplateExpression,
      SyntaxKind,
    } = ensureTypescript();
    if (!isPropertyAssignment(node)) {
      // TODO(leo): handle more scenarios (spread assignments, etc)
      return false;
    }

    const property = properties.find((p) => p === node.name.getText());
    if (!property) {
      return false;
    }

    if (
      node.initializer.kind === SyntaxKind.UndefinedKeyword ||
      node.initializer.kind === SyntaxKind.NullKeyword ||
      node.initializer.kind === SyntaxKind.FalseKeyword
    ) {
      return false;
    }

    if (!isStringLiteralLike(node.initializer)) {
      if (isTemplateExpression(node.initializer)) {
        this.logger.warn(
          `The "${node.name.getText()}" in the Cypress configuration file is set to a template expression ("${node.initializer.getText()}"). ` +
            `This is not supported by the automatic migration and its value won't be automatically migrated. ` +
            `Please make sure to update its value to match the new location if needed.`
        );
      } else {
        this.logger.warn(
          `The "${node.name.getText()}" in the Cypress configuration file is not set to a string literal ("${node.initializer.getText()}"). ` +
            `This is not supported by the automatic migration and its value won't be automatically migrated. ` +
            `Please make sure to update its value to match the new location if needed.`
        );
      }

      return false;
    }

    return true;
  }

  private normalizeNodeText(value: string): string {
    return value.replace(/['"`]/g, '');
  }

  private getOldCypressConfigFilePath(): string | null {
    let cypressConfig: string | null;
    const configFileOption = this.projectConfig.targets.e2e.options.configFile;
    if (configFileOption === false) {
      cypressConfig = null;
    } else if (typeof configFileOption === 'string') {
      cypressConfig = basename(configFileOption);
    } else {
      cypressConfig = this.findCypressConfigFilePath(this.project.oldRoot);
    }

    return cypressConfig;
  }

  private getDefaultCypressConfigFilePath(): string {
    return this.cypressInstalledVersion < 10
      ? joinPathFragments(this.project.newRoot, 'cypress.json')
      : joinPathFragments(this.project.newRoot, 'cypress.config.ts');
  }

  private findCypressConfigFilePath(dir: string): string | null {
    if (this.cypressInstalledVersion < 10) {
      return this.tree.exists(joinPathFragments(dir, 'cypress.json'))
        ? joinPathFragments(dir, 'cypress.json')
        : null;
    }

    // https://docs.cypress.io/guides/references/configuration#Configuration-File
    const possibleFiles = [
      joinPathFragments(dir, 'cypress.config.ts'),
      joinPathFragments(dir, 'cypress.config.js'),
      joinPathFragments(dir, 'cypress.config.mjs'),
      joinPathFragments(dir, 'cypress.config.cjs'),
    ];
    for (const file of possibleFiles) {
      if (this.tree.exists(file)) {
        return file;
      }
    }

    return null;
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
