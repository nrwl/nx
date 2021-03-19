import {
  GeneratorCallback,
  getPackageManagerCommand,
  getProjects,
  joinPathFragments,
  logger,
  NxJsonProjectConfiguration,
  offsetFromRoot,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  removeDependenciesFromPackageJson,
  Tree,
  updateJson,
  updateProjectConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { detectPackageManager } from '@nrwl/tao/src/shared/package-manager';
import { execSync } from 'child_process';
import type { Linter } from 'eslint';
import { tslintToEslintConfigVersion } from '../versions';
import {
  convertTSLintConfig,
  ensureESLintPluginsAreInstalled,
  deduplicateOverrides,
} from './utils';

/**
 * Common schema used by all implementations of convert-tslint-to-eslint generators
 */
export interface ConvertTSLintToESLintSchema {
  project: string;
  removeTSLintIfNoMoreTSLintTargets: boolean;
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
  private readonly projectConfig: ProjectConfiguration &
    NxJsonProjectConfiguration;
  private readonly rootTSLintJsonPath = 'tslint.json';
  private readonly rootTSLintJson: Record<string, unknown>;
  private readonly projectTSLintJsonPath: string;
  private readonly projectTSLintJson: Record<string, unknown>;
  private readonly host: Tree;
  private readonly projectName: string;
  private readonly eslintInitializer: (projectInfo: {
    projectName: string;
    projectConfig: ProjectConfiguration & NxJsonProjectConfiguration;
  }) => Promise<void>;
  private readonly pmc: ReturnType<typeof getPackageManagerCommand>;

  /**
   * Using an object as the argument to the constructor means we sacrifice some
   * authoring sugar around initializing these properties but it makes the usage
   * of the class much easier to read and maintain.
   */
  constructor({
    host,
    projectName,
    eslintInitializer,
  }: {
    host: Tree;
    projectName: string;
    eslintInitializer: (projectInfo: {
      projectName: string;
      projectConfig: ProjectConfiguration & NxJsonProjectConfiguration;
    }) => Promise<void>;
  }) {
    this.host = host;
    this.projectName = projectName;
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

    const pm = detectPackageManager();
    this.pmc = getPackageManagerCommand(pm);

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

  /**
   * In order to avoid all users of Nx needing to have tslint-to-eslint-config (and therefore tslint)
   * in their node_modules, we dynamically install and uninstall the library as part of the conversion
   * process.
   *
   * NOTE: By taking this approach we have to sacrifice dry-run capabilities for this generator.
   */
  installTSLintToESLintConfigPackage() {
    execSync(
      `${this.pmc.addDev} tslint-to-eslint-config@${tslintToEslintConfigVersion}`,
      {
        cwd: this.host.root,
        stdio: [0, 1, 2],
      }
    );
  }

  uninstallTSLintToESLintConfigPackage() {
    execSync(`${this.pmc.rm} tslint-to-eslint-config`, {
      cwd: this.host.root,
      stdio: [0, 1, 2],
    });
  }

  async initESLint() {
    return this.eslintInitializer({
      projectName: this.projectName,
      projectConfig: this.projectConfig,
    });
  }

  /**
   * If the package-specific shareable config already exists then the workspace must already
   * be part way through migrating from TSLint to ESLint. In this case we do not want to convert
   * the root tslint.json again (and this utility will return a noop task), and we instead just
   * focus on the project-level config conversion.
   */
  async convertRootTSLintConfig(
    applyPackageSpecificModifications: (json: Linter.Config) => Linter.Config
  ): Promise<Exclude<GeneratorCallback, void>> {
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
    convertedRootESLintConfig.plugins = convertedRootESLintConfig.plugins.filter(
      (p) =>
        !p.startsWith('@angular-eslint') && !p.startsWith('@typescript-eslint')
    );

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
        for (const override of json.overrides) {
          if (!override.rules) {
            continue;
          }
          if (!override.rules[nxRuleName]) {
            continue;
          }
          override.rules[nxRuleName] = nxEnforceModuleBoundariesRule;
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
      json.overrides = json.overrides || [];
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
      return json;
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
    convertedProjectESLintConfig.plugins = convertedProjectESLintConfig.plugins.filter(
      (p) =>
        !p.startsWith('@angular-eslint') && !p.startsWith('@typescript-eslint')
    );

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
          ...json.plugins,
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
      json.rules = json.rules || {};
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
      return finalJson;
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
    removeTSLintIfNoMoreTSLintTargets: ConvertTSLintToESLintSchema['removeTSLintIfNoMoreTSLintTargets']
  ) {
    const workspace = readWorkspaceConfiguration(this.host);

    workspace.generators = workspace.generators || {};
    workspace.generators[collectionName] =
      workspace.generators[collectionName] || {};
    const prev = workspace.generators[collectionName];

    workspace.generators = {
      ...workspace.generators,
      [collectionName]: {
        ...prev,
        'convert-tslint-to-eslint': {
          removeTSLintIfNoMoreTSLintTargets,
        },
      },
    };

    updateWorkspaceConfiguration(this.host, workspace);
  }
}
