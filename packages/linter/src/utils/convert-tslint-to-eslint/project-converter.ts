import {
  getProjects,
  installPackagesTask,
  joinPathFragments,
  logger,
  offsetFromRoot,
  readJson,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  removeDependenciesFromPackageJson,
  updateJson,
  updateProjectConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import type {
  Tree,
  GeneratorCallback,
  ProjectConfiguration,
} from '@nrwl/devkit';
import type { Linter } from 'eslint';
import { removeParserOptionsProjectIfNotRequired } from '../rules-requiring-type-checking';
import { convertTSLintDisableCommentsForProject } from './convert-to-eslint-config';
import {
  convertTSLintConfig,
  deduplicateOverrides,
  ensureESLintPluginsAreInstalled,
} from './utils';

/**
 * Common schema used by all implementations of convert-tslint-to-eslint generators
 */
export interface ConvertTSLintToESLintSchema {
  project: string;
  // If true, we are effectively just "resetting" to ESLint, rather than converting from TSLint
  ignoreExistingTslintConfig: boolean;
  removeTSLintIfNoMoreTSLintTargets: boolean;
  skipFormat?: boolean;
}

/**
 * When we convert a TSLint setup to an ESLint setup for a particular project, there are a number of
 * shared/common concerns (implemented as library utilities within @nrwl/linter), and a few things
 * which are specific to this package and the types of projects it produces.
 *
 * The key structure of the converted ESLint support is as follows:
 *
 * - We will first generate a workspace root .eslintrc.json which is the same as the one generated
 * for new workspaces (i.e. it is NOT just a converted version of their root tslint.json). This allows us
 * to have a consistent base for all users, as well as standardized patterns around "overrides".
 *
 * - The user's original root tslint.json will be converted and any applicable settings will be stored
 * within ADDITIONAL override blocks within the root .eslintrc.json.
 *
 * - The user's project-level tslint.json file will be converted into a corresponding .eslintrc.json file
 * and it will extend from the root workspace .eslintrc.json file as normal.
 */
export class ProjectConverter {
  private readonly projectConfig: ProjectConfiguration;
  private readonly rootTSLintJsonPath = 'tslint.json';
  private readonly rootTSLintJson: Record<string, unknown>;
  private readonly projectTSLintJsonPath: string;
  private readonly projectTSLintJson: Record<string, unknown>;
  private readonly host: Tree;
  private readonly projectName: string;
  private readonly ignoreExistingTslintConfig: boolean;
  private readonly eslintInitializer: (projectInfo: {
    projectName: string;
    projectConfig: ProjectConfiguration;
  }) => Promise<void>;

  /**
   * Using an object as the argument to the constructor means we sacrifice some
   * authoring sugar around initializing these properties but it makes the usage
   * of the class much easier to read and maintain.
   */
  constructor({
    host,
    projectName,
    ignoreExistingTslintConfig,
    eslintInitializer,
  }: {
    host: Tree;
    projectName: string;
    ignoreExistingTslintConfig: boolean;
    eslintInitializer: (projectInfo: {
      projectName: string;
      projectConfig: ProjectConfiguration;
    }) => Promise<void>;
  }) {
    this.host = host;
    this.projectName = projectName;
    this.ignoreExistingTslintConfig = ignoreExistingTslintConfig;
    this.eslintInitializer = eslintInitializer;
    this.projectConfig = readProjectConfiguration(this.host, this.projectName);
    this.projectTSLintJsonPath = joinPathFragments(
      this.projectConfig.root,
      'tslint.json'
    );

    /**
     * Given the user is converting a project from TSLint to ESLint, we expect them
     * to have both a root and a project-specific tslint.json
     */
    if (!host.exists(this.rootTSLintJsonPath)) {
      throw new Error(
        'We could not find a tslint.json at the root of your workspace, maybe you have already migrated to ESLint?'
      );
    }
    if (!host.exists(this.projectTSLintJsonPath)) {
      throw new Error(
        `We could not find a tslint.json for the selected project "${this.projectTSLintJsonPath}", maybe you have already migrated to ESLint?`
      );
    }
    this.rootTSLintJson = readJson(host, this.rootTSLintJsonPath);
    this.projectTSLintJson = readJson(host, this.projectTSLintJsonPath);

    /**
     * We are not able to support --dry-run in this generator, because we need to dynamically install
     * and use the tslint-to-eslint-config package within the same execution.
     *
     * This is a worthwhile trade-off and the dry-run output doesn't offer a ton of value for this use-case anyway.
     */
    if (
      process.argv.includes('--dry-run') ||
      process.argv.includes('--dryRun') ||
      process.argv.includes('-d')
    ) {
      throw new Error(
        'NOTE: This generator does not support --dry-run. If you are running this in Nx Console, it should execute fine once you hit the "Run" button.\n'
      );
    }
  }

  async initESLint(): Promise<GeneratorCallback> {
    await this.eslintInitializer({
      projectName: this.projectName,
      projectConfig: this.projectConfig,
    });
    // Ensure that all the dependencies added as part ESLint initialization are installed
    return () => {
      installPackagesTask(this.host);
    };
  }

  /**
   * If the package-specific shareable config already exists then the workspace must already
   * be part way through migrating from TSLint to ESLint. In this case we do not want to convert
   * the root tslint.json again (and this utility will return a noop task), and we instead just
   * focus on the project-level config conversion.
   */
  async convertRootTSLintConfig(
    applyPackageSpecificModifications: (json: Linter.Config) => Linter.Config,
    rootEslintConfigExists?: boolean
  ): Promise<Exclude<GeneratorCallback, void>> {
    if (this.ignoreExistingTslintConfig) {
      return Promise.resolve(() => {});
    }
    /**
     * If root eslint already exists, we will not override it with converted tslint
     * as this might break existing configuration in place. This is the common scenario
     * when large projects are migrating one project at a time and apply custom
     * changes to root config in the meantime.
     *
     * We warn user of this action in case .eslintrc.json was created accidentally
     */
    if (rootEslintConfigExists) {
      logger.warn(
        `Root '.eslintrc.json' found. Assuming conversion was already run for other projects.`
      );
      return Promise.resolve(() => {});
    }

    const convertedRoot = await convertTSLintConfig(
      this.rootTSLintJson,
      this.rootTSLintJsonPath,
      []
    );
    const convertedRootESLintConfig = convertedRoot.convertedESLintConfig;

    /**
     * Already set by Nx's shareable configs
     */
    delete convertedRootESLintConfig.env;
    delete convertedRootESLintConfig.parser;
    delete convertedRootESLintConfig.parserOptions;
    if (convertedRootESLintConfig.plugins) {
      convertedRootESLintConfig.plugins =
        convertedRootESLintConfig.plugins.filter(
          (p) => p !== '@typescript-eslint/tslint'
        );
    }

    /**
     * The only piece of the converted root tslint.json that we need to pull out to
     * apply to the existing overrides within the root .eslintrc.json is the
     * @nrwl/nx/enforce-module-boundaries rule.
     */
    const nxRuleName = '@nrwl/nx/enforce-module-boundaries';
    const nxEnforceModuleBoundariesRule =
      convertedRootESLintConfig.rules[nxRuleName];
    if (nxEnforceModuleBoundariesRule) {
      updateJson(this.host, '.eslintrc.json', (json) => {
        if (!json.overrides) {
          return json;
        }
        for (const o of json.overrides) {
          if (!o.rules) {
            continue;
          }
          if (!o.rules[nxRuleName]) {
            continue;
          }
          o.rules[nxRuleName] = nxEnforceModuleBoundariesRule;
        }
        return json;
      });
      /**
       * Remove it once we've used it on the root, so that is isn't applied
       * to the package-specific shareable config
       */
      delete convertedRootESLintConfig.rules[nxRuleName];
    }

    /**
     * Update the root workspace .eslintrc.json with additional overrides
     */
    const finalConvertedRootESLintConfig = applyPackageSpecificModifications(
      convertedRootESLintConfig
    );
    updateJson(this.host, '.eslintrc.json', (json) => {
      json.overrides ||= [];
      if (
        finalConvertedRootESLintConfig.overrides &&
        finalConvertedRootESLintConfig.overrides.length
      ) {
        json.overrides = [
          ...json.overrides,
          ...finalConvertedRootESLintConfig.overrides,
        ];
      } else {
        json.overrides.push({
          files: ['*.ts'],
          ...finalConvertedRootESLintConfig,
        });
      }
      json.overrides = deduplicateOverrides(json.overrides);
      /**
       * Remove the parserOptions.project config if it is not required for the final config,
       * so that lint runs can be as fast and efficient as possible.
       */
      return removeParserOptionsProjectIfNotRequired(json);
    });

    /**
     * Through converting the config we may encounter TSLint rules whose closest
     * equivalent in the ESLint ecosystem comes from a separate package/plugin.
     *
     * We therefore automatically install those extra packages for the user and
     * explain that that's what we are doing.
     */
    return ensureESLintPluginsAreInstalled(
      this.host,
      convertedRoot.ensureESLintPlugins
    );
  }

  async convertProjectConfig(
    applyPackageSpecificModifications: (json: Linter.Config) => Linter.Config
  ): Promise<GeneratorCallback> {
    if (this.ignoreExistingTslintConfig) {
      return Promise.resolve(() => {});
    }

    const convertedProjectConfig = await convertTSLintConfig(
      this.projectTSLintJson,
      this.projectTSLintJsonPath,
      // Strip the extends on workspace tslint.json (see this util's docs for more info)
      [`${offsetFromRoot(this.projectConfig.root)}tslint.json`]
    );

    const convertedProjectESLintConfig =
      convertedProjectConfig.convertedESLintConfig;

    /**
     * Already set by Nx's shareable configs
     */
    delete convertedProjectESLintConfig.env;
    delete convertedProjectESLintConfig.parser;
    delete convertedProjectESLintConfig.parserOptions;
    if (convertedProjectESLintConfig.plugins) {
      convertedProjectESLintConfig.plugins =
        convertedProjectESLintConfig.plugins.filter(
          (p) => p !== '@typescript-eslint/tslint'
        );
    }

    const projectESLintConfigPath = joinPathFragments(
      this.projectConfig.root,
      '.eslintrc.json'
    );

    /**
     * Apply updates to the new .eslintrc.json file for the project
     */
    updateJson(this.host, projectESLintConfigPath, (json) => {
      if (typeof json.extends === 'string') {
        json.extends = [json.extends];
      }
      // Custom extends from conversion
      if (
        Array.isArray(convertedProjectESLintConfig.extends) &&
        convertedProjectESLintConfig.extends.length
      ) {
        // Ignore any tslint-to-eslint-config default extends that do not apply to Nx
        const applicableExtends = convertedProjectESLintConfig.extends.filter(
          (ext) => !ext.startsWith('prettier')
        );
        if (applicableExtends.length) {
          json.extends = [...json.extends, ...applicableExtends];
        }
      }
      // Custom plugins from conversion
      if (
        Array.isArray(convertedProjectESLintConfig.plugins) &&
        convertedProjectESLintConfig.plugins.length
      ) {
        json.plugins = [
          ...(json.plugins ?? []),
          ...convertedProjectESLintConfig.plugins,
        ];
      }
      /**
       * Custom rules
       *
       * By default, tslint-to-eslint-config will try and apply any rules without known converters
       * by using eslint-plugin-tslint. We instead explicitly warn the user about this missing converter,
       * and therefore at this point we strip out any rules which start with @typescript-eslint/tslint/config
       */
      json.rules ||= {};
      if (
        convertedProjectESLintConfig.rules &&
        Object.keys(convertedProjectESLintConfig.rules).length
      ) {
        for (const [ruleName, ruleConfig] of Object.entries(
          convertedProjectESLintConfig.rules
        )) {
          if (!ruleName.startsWith('@typescript-eslint/tslint/config')) {
            // Prioritize the converted rules over any base implementations from the original Nx generator
            json.rules[ruleName] = ruleConfig;
          }
        }
      }
      /**
       * Apply any package-specific modifications to the converted config before
       * updating the config file.
       */
      const finalJson = applyPackageSpecificModifications(json);
      /**
       * Remove the parserOptions.project config if it is not required for the final config,
       * so that lint runs can be as fast and efficient as possible.
       */
      return removeParserOptionsProjectIfNotRequired(finalJson);
    });

    /**
     * Convert any instances of comment-based configuration in the source files
     * of the project
     */
    convertTSLintDisableCommentsForProject(this.host, this.projectName);

    /**
     * Through converting the config we may encounter TSLint rules whose closest
     * equivalent in the ESLint ecosystem comes from a separate package/plugin.
     *
     * We therefore automatically install those extra packages for the user and
     * explain that that's what we are doing.
     */
    return ensureESLintPluginsAreInstalled(
      this.host,
      convertedProjectConfig.ensureESLintPlugins
    );
  }

  removeProjectTSLintFile() {
    this.host.delete(joinPathFragments(this.projectConfig.root, 'tslint.json'));
  }

  isTSLintUsedInWorkspace(): boolean {
    const projects = getProjects(this.host);
    for (const [, projectConfig] of projects.entries()) {
      for (const [, targetConfig] of Object.entries(projectConfig.targets)) {
        if (targetConfig.executor === '@angular-devkit/build-angular:tslint') {
          // Workspace is still using TSLint, exit early
          return true;
        }
      }
    }
    // If we got this far the user has no remaining TSLint usage
    return false;
  }

  removeTSLintFromWorkspace(): GeneratorCallback {
    logger.info(
      `No TSLint usage will remain in the workspace, removing TSLint...`
    );
    /**
     * Delete the root tslint.json
     */
    this.host.delete(this.rootTSLintJsonPath);

    /**
     * Prepare the package.json and the uninstall task
     */
    const uninstallTask = removeDependenciesFromPackageJson(
      this.host,
      [],
      ['tslint', 'codelyzer']
    );

    /**
     * Update global linter configuration defaults in workspace.json
     */
    const workspace = readWorkspaceConfiguration(this.host);
    this.cleanUpGeneratorsConfig(workspace);
    updateWorkspaceConfiguration(this.host, workspace);

    /**
     * Update project-level linter configuration defaults in workspace.json
     */
    const projects = getProjects(this.host);
    for (const [projectName, { generators }] of projects.entries()) {
      if (!generators || Object.keys(generators).length === 0) {
        continue;
      }
      const project = readProjectConfiguration(this.host, projectName);
      this.cleanUpGeneratorsConfig(project);
      updateProjectConfiguration(this.host, projectName, project);
    }

    return uninstallTask;
  }

  private cleanUpGeneratorsConfig(parentConfig: { generators?: any }) {
    if (
      !parentConfig.generators ||
      Object.keys(parentConfig.generators).length === 0
    ) {
      return;
    }
    for (const [collectionName, maybeGeneratorConfig] of Object.entries(
      parentConfig.generators
    )) {
      // Shorthand syntax is possible
      if (collectionName.includes(':')) {
        const generatorConfig = maybeGeneratorConfig;
        for (const optionName of Object.keys(generatorConfig)) {
          if (optionName === 'linter') {
            // Default is eslint, so in all cases we can just remove the config altogether
            delete generatorConfig[optionName];
          }
        }
        // If removing linter leaves no other options in the config, remove the config as well
        if (Object.keys(generatorConfig).length === 0) {
          delete parentConfig.generators[collectionName];
        }
      } else {
        // Not shorthand syntax, so next level down is generator name -> config mapping
        const collectionConfig = maybeGeneratorConfig;

        for (const [generatorName, generatorConfig] of Object.entries(
          collectionConfig
        )) {
          if (generatorName === 'convert-tslint-to-eslint') {
            // No longer relevant because of TSLint is being removed the conversion process must be complete
            delete collectionConfig[generatorName];
            continue;
          }

          for (const optionName of Object.keys(generatorConfig)) {
            if (optionName === 'linter') {
              // Default is eslint, so in all cases we can just remove the config altogether
              delete generatorConfig[optionName];
            }
          }
          // If removing linter leaves no other options in the config, remove the generator config as well
          if (Object.keys(generatorConfig).length === 0) {
            delete collectionConfig[generatorName];
          }
        }

        // If removing the generator leaves no other generators in the config, remove the config as well
        if (
          parentConfig.generators[collectionName] &&
          Object.keys(parentConfig.generators[collectionName]).length === 0
        ) {
          delete parentConfig.generators[collectionName];
        }
      }
    }

    // If removing the linter defaults leaves absolutely no generators configuration remaining, remove it
    if (Object.keys(parentConfig.generators).length === 0) {
      delete parentConfig.generators;
    }
  }

  /**
   * If the project which is the subject of the ProjectConverter instance is an application,
   * figure out its associated e2e project's name.
   */
  getE2EProjectName(): string | null {
    if (this.projectConfig.projectType !== 'application') {
      return null;
    }
    let e2eProjectName = null;

    const projects = getProjects(this.host);
    for (const [projectName, projectConfig] of projects.entries()) {
      for (const [, targetConfig] of Object.entries(projectConfig.targets)) {
        if (targetConfig.executor === '@nrwl/cypress:cypress') {
          if (
            targetConfig.options.devServerTarget === `${this.projectName}:serve`
          ) {
            e2eProjectName = projectName;
            logger.info(
              `Found e2e project for "${this.projectName}" called "${e2eProjectName}", converting that project as well...`
            );
          }
        }
      }
    }
    return e2eProjectName;
  }

  setDefaults(
    collectionName: string,
    defaults: Partial<ConvertTSLintToESLintSchema>
  ) {
    const workspace = readWorkspaceConfiguration(this.host);

    workspace.generators ||= {};
    workspace.generators[collectionName] ||= {};
    const prev = workspace.generators[collectionName];

    workspace.generators = {
      ...workspace.generators,
      [collectionName]: {
        ...prev,
        'convert-tslint-to-eslint': {
          ...prev['convert-tslint-to-eslint'],
          ...defaults,
        },
      },
    };

    updateWorkspaceConfiguration(this.host, workspace);
  }
}
