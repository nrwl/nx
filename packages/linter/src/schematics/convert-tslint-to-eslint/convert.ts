import { join, normalize } from '@angular-devkit/core';
import {
  chain,
  noop,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { offsetFromRoot } from '@nrwl/devkit';
import { getPackageManagerCommand } from '@nrwl/tao/src/shared/package-manager';
import {
  addLintFiles,
  formatFiles,
  generateProjectLint,
  getProjectConfig,
  Linter,
  readJsonInTree,
  updateJsonInTree,
  updateWorkspaceInTree,
  visitNotIgnoredFiles,
} from '@nrwl/workspace';
import { execSync } from 'child_process';
import type { Linter as ESLintLinter } from 'eslint';
import { writeFileSync } from 'fs';
import {
  convertFileComments,
  TSLintRuleOptions,
} from 'tslint-to-eslint-config';
import {
  createAngularProjectESLintLintTarget,
  extraEslintDependencies,
} from '@nrwl/angular';
import { convertToESLintConfig } from './lib/convert-to-eslint-config';
import { removeTSLintIfNoMoreTSLintTargets } from './lib/remove-tslint-if-no-more-tslint-targets';
import {
  ensureESLintPluginsAreInstalled,
  isAngularProject,
  isE2EProject,
  updateArrPropAndRemoveDuplication,
  updateObjPropAndRemoveDuplication,
} from './lib/utils';
import { ConvertTSLintToESLintSchema } from './schema';
import { convertTslintNxRuleToEslintNxRule } from './lib/convert-nx-enforce-module-boundaries-rule';

type ProjectKind = 'e2e' | 'angular' | 'other';

export default function (schema: ConvertTSLintToESLintSchema): Rule {
  return (tree: Tree, context: SchematicContext) => {
    /**
     * We are not able to support --dry-run in this schematic, because we need to (potentially) both install
     * and use the @nrwl/eslint-plugin-nx package within the same execution.
     *
     * This is a worthwhile trade-off to avoid the need to force the user to manually run an install before
     * invoking the schematic, and the dry-run output doesn't offer a ton of value for this use-case anyway.
     */
    if (
      process.argv.includes('--dry-run') ||
      process.argv.includes('--dryRun') ||
      process.argv.includes('-d')
    ) {
      context.logger.error(
        'NOTE: This schematic does not support --dry-run. If you are running this in Nx Console, it should execute fine once you hit the "Run" button.\n'
      );
      return process.exit(1);
    }

    if (!tree.exists('package.json')) {
      throw new Error(
        'Could not find a `package.json` file at the root of your workspace'
      );
    }

    /**
     * Ensure that the @nrwl/eslint-plugin-nx is installed
     */
    const packageJSON = tree.read('package.json').toString('utf-8');
    const json = JSON.parse(packageJSON);

    if (
      !json.devDependencies?.['@nrwl/eslint-plugin-nx'] &&
      !json.dependencies?.['@nrwl/eslint-plugin-nx']
    ) {
      const version: string | undefined =
        json.devDependencies['@nrwl/workspace'];

      context.logger.info(
        '\nINFO: We are installing @nrwl/eslint-plugin-nx at the same version as your other @nrwl dependencies so that we can use it as part of the config generation...\n'
      );

      const pmc = getPackageManagerCommand();
      execSync(`${pmc.addDev} @nrwl/eslint-plugin-nx@${version}`, {
        stdio: 'ignore', // suppress any warnings about missing peerDeps to avoid confusion, they are all installed as part of the remaining schematic execution
      });
      context.logger.info(
        '      Successfully installed @nrwl/eslint-plugin-nx\n'
      );
    }

    const projectConfig = getProjectConfig(tree, schema.project);
    const projectRoot = projectConfig.root;

    // Expected existing files
    const rootTSLintJsonPath = join(normalize(tree.root.path), 'tslint.json');
    const projectTSLintJsonPath = join(normalize(projectRoot), 'tslint.json');

    /**
     * May or may not exist yet, depending on whether or not the schematic has been run
     * before, or if this is already a mixed ESLint + TSLint workspace
     */
    const rootESLintrcJsonPath = join(
      normalize(tree.root.path),
      '.eslintrc.json'
    );
    const shouldConvertRootConfig = !tree.exists(rootESLintrcJsonPath);

    let projectLintConfigConverter: (
      projectRoot: string,
      projectTSLintJsonPath: string,
      rootESLintrcJsonPath: string
    ) => Rule;
    let projectKind: ProjectKind;

    switch (true) {
      case isE2EProject(schema.project, projectConfig):
        projectLintConfigConverter = convertE2EProjectTSLintConfig;
        projectKind = 'e2e';
        break;
      case isAngularProject(tree, projectConfig):
        projectLintConfigConverter = convertAngularProjectTSLintConfig;
        projectKind = 'angular';
        break;
      default:
        projectLintConfigConverter = convertOtherProjectTSLintConfig;
        projectKind = 'other';
        break;
    }

    return chain([
      /**
       * Handle adding ESLint and related dependencies and configuration
       */
      addAllConfigFilesAndCoreDependencies(projectRoot),
      /**
       * If there was no previous .eslintrc.json at the root of the workspace we need to convert
       * the root tslint config
       */
      shouldConvertRootConfig
        ? convertRootTSLintConfig(rootTSLintJsonPath, rootESLintrcJsonPath)
        : noop(),
      /**
       * Ensure that the same TSLint config coming from the root is not converted over and over.
       */
      removeExtendsFromProjectTSLintConfigBeforeConverting(
        projectRoot,
        projectTSLintJsonPath
      ),
      /**
       * The conversion logic needs to be different for Angular projects vs e2e projects
       * vs other project types which could use TSLint (such as NestJS).
       */
      projectLintConfigConverter(
        projectRoot,
        projectTSLintJsonPath,
        rootESLintrcJsonPath
      ),
      /**
       * Update the workspace config to use the ESLint executor
       */
      updateLintTargetForProject(schema.project, projectRoot, projectKind),
      /**
       * Update any tslint:disable comments to their ESLint equivalent within
       * project source files
       */
      convertTSLintDisableCommentsForProject(projectRoot),
      /**
       * Perform global clean up of TSLint if there are no more TSLint targets
       * remaining at the end of the current conversion.
       */
      schema.removeTSLintIfNoMoreTSLintTargets
        ? removeTSLintIfNoMoreTSLintTargets(rootTSLintJsonPath)
        : noop(),
      /**
       * Format everything we've updated
       */
      formatFiles(),
    ]);
  };
}

function addAllConfigFilesAndCoreDependencies(projectRoot: string): Rule {
  /**
   * If the root .eslintrc.json does not exist at the time of running the schematic
   * this is the first project within the workspace that is being converted.
   *
   * The addLintFiles() util will handle creating the root .eslintrc.json file with the
   * standard global config that Nx creates for all new workspaces.
   *
   * addLintFiles() will also create a .eslintrc.json for the project itself, but it is not
   * an issue because we will overwrite that later with our converted TSLint config.
   */
  return addLintFiles(projectRoot, Linter.EsLint, {
    onlyGlobal: false,
    localConfig: null,
    extraPackageDeps: extraEslintDependencies,
  });
}

function updateLintTargetForProject(
  projectName: string,
  projectRoot: string,
  projectKind: ProjectKind
) {
  return updateWorkspaceInTree((json) => {
    switch (projectKind) {
      case 'angular':
        json.projects[
          projectName
        ].architect.lint = createAngularProjectESLintLintTarget(projectRoot);
        break;

      case 'e2e':
      case 'other':
        json.projects[
          projectName
        ].architect.lint = generateProjectLint(
          normalize(projectRoot),
          join(normalize(projectRoot), 'tsconfig.e2e.json'),
          Linter.EsLint,
          [`${projectRoot}/**/*.ts`]
        );
        break;
    }

    return json;
  });
}

async function convertTSLintConfig(
  tree: Tree,
  context: SchematicContext,
  projectTSLintJsonPath: string
) {
  const rawProjectTSLintJson = readJsonInTree(tree, projectTSLintJsonPath);

  /**
   * NOTE: We have to write the updated project TSLint to disk because part of the conversion logic
   * executes the TSLint CLI which reads from disk - there is no equivalent API within
   * TSLint as a library, unfortunately.
   *
   * The user will not see the update because we later delete the file.
   */
  writeFileSync(projectTSLintJsonPath, JSON.stringify(rawProjectTSLintJson));

  const convertedProject = await convertToESLintConfig(
    projectTSLintJsonPath,
    rawProjectTSLintJson
  );

  /**
   * Apply the custom converter for the nx-module-boundaries rule if applicable
   */
  const convertedNxRule = convertTslintNxRuleToEslintNxRule(
    rawProjectTSLintJson
  );
  if (convertedNxRule) {
    convertedProject.convertedESLintConfig.rules =
      convertedProject.convertedESLintConfig.rules || {};
    convertedProject.convertedESLintConfig.rules[convertedNxRule.ruleName] =
      convertedNxRule.ruleConfig;
  }

  warnInCaseOfUnconvertedRules(
    context,
    projectTSLintJsonPath,
    convertedProject.unconvertedTSLintRules
  );

  return convertedProject;
}

function convertAngularProjectTSLintConfig(
  projectRoot: string,
  projectTSLintJsonPath: string,
  rootESLintrcJsonPath: string
): Rule {
  return async (tree, context) => {
    const rawRootESLintrcJson = readJsonInTree(tree, rootESLintrcJsonPath);
    const convertedProject = await convertTSLintConfig(
      tree,
      context,
      projectTSLintJsonPath
    );

    const convertedProjectESLintConfig = convertedProject.convertedESLintConfig;

    // Ensure no-console can be deterministically deduped
    if (convertedProjectESLintConfig.rules?.['no-console']?.[1]) {
      convertedProjectESLintConfig.rules['no-console'][1].allow.sort();
    }

    /**
     * We require these in dynamically because they may not be present statically before the schematic runs.
     * At this point, though, these packages should have been installed by earlier Rules.
     */
    const nxESLintPlugin = require('@nrwl/eslint-plugin-nx');
    const {
      configs: { angular: nxESLintPluginAngularConfigOriginal },
    } = nxESLintPlugin;
    const {
      configs: {
        'angular-template': nxESLintPluginAngularTemplateConfigOriginal,
      },
    } = nxESLintPlugin;

    const angularESLintPlugin = require('@angular-eslint/eslint-plugin');
    const angularESLintPluginTemplate = require('@angular-eslint/eslint-plugin-template');

    const angularESLintPluginConfigBaseOriginal: any =
      angularESLintPlugin.configs.base;
    const angularESLintPluginConfigRecommendedOriginal: any =
      angularESLintPlugin.configs.recommended;
    const angularESLintPluginTemplateConfigRecommendedOriginal: any =
      angularESLintPluginTemplate.configs.recommended;

    // We mutate these as part of the transformations, so make copies first
    const nxESLintPluginAngularConfig = {
      ...nxESLintPluginAngularConfigOriginal,
    };
    const nxESLintPluginAngularTemplateConfig = {
      ...nxESLintPluginAngularTemplateConfigOriginal,
    };

    const angularESLintPluginConfigBase = {
      ...angularESLintPluginConfigBaseOriginal,
    };
    const angularESLintPluginConfigRecommended = {
      ...angularESLintPluginConfigRecommendedOriginal,
    };
    const angularESLintPluginTemplateConfigRecommended = {
      ...angularESLintPluginTemplateConfigRecommendedOriginal,
    };

    /**
     * To avoid users' configs being bigger and more verbose than necessary, we perform some
     * deduplication against our underlying configuration that they will extend from,
     * as well as the root config.
     */

    dedupePluginsAgainstConfigs(convertedProjectESLintConfig, [
      angularESLintPluginConfigBase,
      angularESLintPluginConfigRecommended,
      nxESLintPluginAngularConfig,
      {
        plugins: [
          '@angular-eslint/eslint-plugin', // this is another alias to consider when deduping
          '@angular-eslint/eslint-plugin-template', // will be handled in separate overrides block
          '@typescript-eslint/tslint', // see note on not depending on not wanting to depend on TSLint fallback
        ],
      },
    ]);

    updateArrPropAndRemoveDuplication(
      convertedProjectESLintConfig,
      {
        /**
         * The prettier related extends are already included via the Nx TypeScript config
         * which is used in the root .eslintrc.json file
         */
        extends: ['prettier', 'prettier/@typescript-eslint'],
      },
      'extends',
      true
    );

    dedupeRulesAgainstConfigs(convertedProjectESLintConfig, [
      angularESLintPluginConfigBase,
      angularESLintPluginConfigRecommended,
      nxESLintPluginAngularConfig,
      rawRootESLintrcJson,
    ]);

    dedupeEnvAgainstConfigs(convertedProjectESLintConfig, [
      angularESLintPluginConfigBase,
      angularESLintPluginConfigRecommended,
      nxESLintPluginAngularConfig,
      rawRootESLintrcJson,
    ]);

    const { codeRules, templateRules } = separateCodeAndTemplateRules(
      convertedProjectESLintConfig
    );

    updateObjPropAndRemoveDuplication(
      { rules: templateRules },
      angularESLintPluginTemplateConfigRecommended,
      'rules',
      false
    );
    updateObjPropAndRemoveDuplication(
      { rules: templateRules },
      nxESLintPluginAngularTemplateConfig,
      'rules',
      false
    );

    const convertedExtends = convertedProjectESLintConfig.extends;
    delete convertedProjectESLintConfig.extends;

    // Extend from the workspace's root config at the top level
    const relativeOffestToRootESLintrcJson = `${offsetFromRoot(
      projectRoot
    )}.eslintrc.json`;
    convertedProjectESLintConfig.extends = relativeOffestToRootESLintrcJson;

    convertedProjectESLintConfig.ignorePatterns = ['!**/*'];

    convertedProjectESLintConfig.overrides = [
      {
        files: ['*.ts'],
        extends: [
          'plugin:@nrwl/nx/angular',
          'plugin:@angular-eslint/template/process-inline-templates',
          ...ensureStringArray(convertedExtends),
        ],
        parserOptions: {
          project: [`${projectRoot}/tsconfig.*?.json`],
        },
        rules: codeRules,
      },

      {
        files: ['*.html'],
        extends: ['plugin:@nrwl/nx/angular-template'],
        rules: templateRules,
      },
    ];

    // No longer relevant/required
    delete convertedProjectESLintConfig.parser;
    delete convertedProjectESLintConfig.parserOptions;

    // All applied in the .ts overrides block so should no longer be at the root of the config
    delete convertedProjectESLintConfig.rules;
    delete convertedProjectESLintConfig.plugins;

    return chain([
      ensureESLintPluginsAreInstalled(convertedProject.ensureESLintPlugins),
      // Create the .eslintrc.json file in the tree using the finalized config
      updateJsonInTree(
        join(normalize(projectRoot), '.eslintrc.json'),
        () => convertedProjectESLintConfig
      ),
      // Delete the project's tslint.json, it's no longer needed
      (host) => host.delete(projectTSLintJsonPath),
    ]);
  };
}

function convertE2EProjectTSLintConfig(
  projectRoot: string,
  projectTSLintJsonPath: string,
  rootESLintrcJsonPath: string
): Rule {
  return async (tree, context) => {
    /**
     * We need to first determine if this is a Protractor or Cypress E2E project.
     * At the time of writing, Nx does not include a lint config file with either
     * ESLint or TSLint when used with Protractor.
     */
    if (tree.exists(join(normalize(projectRoot), 'protractor.conf.js'))) {
      /**
       * There is (likely) no lint config file for us to convert, just the workspace config
       * needs updating and that is handled by a later rule in this schematic.
       */
      return;
    }

    const rawRootESLintrcJson = readJsonInTree(tree, rootESLintrcJsonPath);
    const convertedProject = await convertTSLintConfig(
      tree,
      context,
      projectTSLintJsonPath
    );

    const convertedProjectESLintConfig = convertedProject.convertedESLintConfig;

    /**
     * To avoid users' configs being bigger and more verbose than necessary, we perform some
     * deduplication against our underlying configuration that they will extend from,
     * as well as the root config.
     */

    updateArrPropAndRemoveDuplication(
      convertedProjectESLintConfig,
      {
        /**
         * The prettier related extends are already included via the Nx TypeScript config
         * which is used in the root .eslintrc.json file
         */
        extends: ['prettier', 'prettier/@typescript-eslint'],
      },
      'extends',
      true
    );

    dedupeRulesAgainstConfigs(convertedProjectESLintConfig, [
      rawRootESLintrcJson,
    ]);

    dedupeEnvAgainstConfigs(convertedProjectESLintConfig, [
      rawRootESLintrcJson,
      {
        env: {
          browser: true,
          es6: true,
          node: true,
        },
      },
    ]);

    dedupePluginsAgainstConfigs(convertedProjectESLintConfig, [
      {
        plugins: [
          '@typescript-eslint', // brought in already by nx typescript config
          '@typescript-eslint/eslint-plugin', // this is another alias to consider when deduping
        ],
      },
    ]);

    const convertedExtends = convertedProjectESLintConfig.extends;
    delete convertedProjectESLintConfig.extends;

    // Extend from the workspace's root config at the top level
    const relativeOffestToRootESLintrcJson = `${offsetFromRoot(
      projectRoot
    )}.eslintrc.json`;

    /**
     * eslint-plugin-cypress was installed as part of the global lint setup earlier in the
     * schematic run
     */
    convertedProjectESLintConfig.extends = [
      'plugin:cypress/recommended',
      relativeOffestToRootESLintrcJson,
    ];

    convertedProjectESLintConfig.ignorePatterns = ['!**/*'];

    const tsExtends = ensureStringArray(convertedExtends).filter(
      (e) => e !== 'plugin:cypress/recommended'
    );

    const tsPlugins = convertedProjectESLintConfig.plugins || [];

    convertedProjectESLintConfig.overrides = [
      {
        files: ['src/plugins/index.js'],
        rules: {
          '@typescript-eslint/no-var-requires': 'off',
          'no-undef': 'off',
        },
      },
      {
        files: ['*.ts'],
        extends: tsExtends.length > 0 ? tsExtends : undefined,
        parserOptions: {
          project: [`${projectRoot}/tsconfig.*?.json`],
        },
        plugins: tsPlugins.length > 0 ? tsExtends : undefined,
        rules: {
          ...convertedProjectESLintConfig.rules,
          /**
           * These two create some noise with Nx generated commands.ts in Cypress projects
           */
          '@typescript-eslint/no-namespace': 'off',
          '@typescript-eslint/no-unused-vars': 'off',
        },
      },
    ];

    // No longer relevant/required
    delete convertedProjectESLintConfig.parser;
    delete convertedProjectESLintConfig.parserOptions;

    // All applied in the .ts overrides block so should no longer be at the root of the config
    delete convertedProjectESLintConfig.rules;
    delete convertedProjectESLintConfig.plugins;

    return chain([
      ensureESLintPluginsAreInstalled(convertedProject.ensureESLintPlugins),
      // Create the .eslintrc.json file in the tree using the finalized config
      updateJsonInTree(
        join(normalize(projectRoot), '.eslintrc.json'),
        () => convertedProjectESLintConfig
      ),
      // Delete the project's tslint.json, it's no longer needed
      (host) => host.delete(projectTSLintJsonPath),
    ]);
  };
}

function convertOtherProjectTSLintConfig(
  projectRoot: string,
  projectTSLintJsonPath: string,
  rootESLintrcJsonPath: string
): Rule {
  return async (tree, context) => {
    const rawRootESLintrcJson = readJsonInTree(tree, rootESLintrcJsonPath);
    const convertedProject = await convertTSLintConfig(
      tree,
      context,
      projectTSLintJsonPath
    );

    const convertedProjectESLintConfig = convertedProject.convertedESLintConfig;

    /**
     * To avoid users' configs being bigger and more verbose than necessary, we perform some
     * deduplication against our underlying configuration that they will extend from,
     * as well as the root config.
     */

    updateArrPropAndRemoveDuplication(
      convertedProjectESLintConfig,
      {
        /**
         * The prettier related extends are already included via the Nx TypeScript config
         * which is used in the root .eslintrc.json file
         */
        extends: ['prettier', 'prettier/@typescript-eslint'],
      },
      'extends',
      true
    );

    dedupeRulesAgainstConfigs(convertedProjectESLintConfig, [
      rawRootESLintrcJson,
    ]);

    dedupeEnvAgainstConfigs(convertedProjectESLintConfig, [
      rawRootESLintrcJson,
      {
        env: {
          browser: true,
          es6: true,
          node: true,
        },
      },
    ]);

    dedupePluginsAgainstConfigs(convertedProjectESLintConfig, [
      {
        plugins: [
          '@typescript-eslint', // brought in already by nx typescript config
          '@typescript-eslint/eslint-plugin', // this is another alias to consider when deduping
        ],
      },
    ]);

    const convertedExtends = convertedProjectESLintConfig.extends;
    delete convertedProjectESLintConfig.extends;

    // Extend from the workspace's root config at the top level
    const relativeOffestToRootESLintrcJson = `${offsetFromRoot(
      projectRoot
    )}.eslintrc.json`;
    convertedProjectESLintConfig.extends = relativeOffestToRootESLintrcJson;

    convertedProjectESLintConfig.ignorePatterns = ['!**/*'];

    const tsExtends = ensureStringArray(convertedExtends);
    const tsPlugins = convertedProjectESLintConfig.plugins || [];

    convertedProjectESLintConfig.overrides = [
      {
        files: ['*.ts'],
        extends: tsExtends.length > 0 ? tsExtends : undefined,
        parserOptions: {
          project: [`${projectRoot}/tsconfig.*?.json`],
        },
        plugins: tsPlugins.length > 0 ? tsExtends : undefined,
        rules: {
          ...convertedProjectESLintConfig.rules,
        },
      },
    ];

    // No longer relevant/required
    delete convertedProjectESLintConfig.parser;
    delete convertedProjectESLintConfig.parserOptions;

    // All applied in the .ts overrides block so should no longer be at the root of the config
    delete convertedProjectESLintConfig.rules;
    delete convertedProjectESLintConfig.plugins;

    return chain([
      ensureESLintPluginsAreInstalled(convertedProject.ensureESLintPlugins),
      // Create the .eslintrc.json file in the tree using the finalized config
      updateJsonInTree(
        join(normalize(projectRoot), '.eslintrc.json'),
        () => convertedProjectESLintConfig
      ),
      // Delete the project's tslint.json, it's no longer needed
      (host) => host.delete(projectTSLintJsonPath),
    ]);
  };
}

function convertRootTSLintConfig(
  rootTSLintJsonPath: string,
  rootESLintrcJsonPath: string
): Rule {
  return async (tree, context) => {
    const convertedRoot = await convertTSLintConfig(
      tree,
      context,
      rootTSLintJsonPath
    );

    const convertedRootESLintConfig = convertedRoot.convertedESLintConfig;

    /**
     * We require these in dynamically because they may not be present statically before the schematic runs.
     * At this point, though, these packages should have been installed by earlier Rules.
     */
    const nxESLintPlugin = require('@nrwl/eslint-plugin-nx');
    const {
      configs: { angular: nxESLintPluginAngularConfigOriginal },
    } = nxESLintPlugin;
    const {
      configs: {
        'angular-template': nxESLintPluginAngularTemplateConfigOriginal,
      },
    } = nxESLintPlugin;

    const angularESLintPlugin = require('@angular-eslint/eslint-plugin');
    const angularESLintPluginTemplate = require('@angular-eslint/eslint-plugin-template');

    const angularESLintPluginConfigBaseOriginal: any =
      angularESLintPlugin.configs.base;
    const angularESLintPluginConfigRecommendedOriginal: any =
      angularESLintPlugin.configs.recommended;
    const angularESLintPluginTemplateConfigRecommendedOriginal: any =
      angularESLintPluginTemplate.configs.recommended;

    // We mutate these as part of the transformations, so make copies first
    const nxESLintPluginAngularConfig = {
      ...nxESLintPluginAngularConfigOriginal,
    };
    const nxESLintPluginAngularTemplateConfig = {
      ...nxESLintPluginAngularTemplateConfigOriginal,
    };

    const angularESLintPluginConfigBase = {
      ...angularESLintPluginConfigBaseOriginal,
    };
    const angularESLintPluginConfigRecommended = {
      ...angularESLintPluginConfigRecommendedOriginal,
    };
    const angularESLintPluginTemplateConfigRecommended = {
      ...angularESLintPluginTemplateConfigRecommendedOriginal,
    };

    /**
     * To avoid users' configs being bigger and more verbose than necessary, we perform some
     * deduplication against our underlying configuration that they will extend from
     */

    dedupePluginsAgainstConfigs(convertedRootESLintConfig, [
      angularESLintPluginConfigBase,
      angularESLintPluginConfigRecommended,
      angularESLintPluginTemplateConfigRecommended,
      nxESLintPluginAngularConfig,
      {
        plugins: [
          '@angular-eslint/eslint-plugin', // this is another alias to consider when deduping
          '@angular-eslint/eslint-plugin-template', // will be handled in separate overrides block
          '@typescript-eslint/tslint', // see note on not depending on not wanting to depend on TSLint fallback
        ],
      },
    ]);

    updateArrPropAndRemoveDuplication(
      convertedRootESLintConfig,
      {
        /**
         * The prettier related extends are already included via the Nx TypeScript config
         * which is used in the root .eslintrc.json file
         */
        extends: ['prettier', 'prettier/@typescript-eslint'],
      },
      'extends',
      true
    );

    dedupeRulesAgainstConfigs(convertedRootESLintConfig, [
      angularESLintPluginConfigBase,
      angularESLintPluginConfigRecommended,
      angularESLintPluginTemplateConfigRecommended,
      nxESLintPluginAngularConfig,
    ]);

    dedupeEnvAgainstConfigs(convertedRootESLintConfig, [
      angularESLintPluginConfigBase,
      angularESLintPluginConfigRecommended,
      angularESLintPluginTemplateConfigRecommended,
      nxESLintPluginAngularConfig,
    ]);

    return chain([
      ensureESLintPluginsAreInstalled(convertedRoot.ensureESLintPlugins),
      updateJsonInTree(rootESLintrcJsonPath, (json) => {
        const nxESLintRuleName = '@nrwl/nx/enforce-module-boundaries';
        /**
         * The fact that we are in this conversion function means that this .eslintrc.json was only
         * just created using the Nx internal lint utils so we theoretically know exactly what structure
         * it has.
         *
         * Nevertheless, to minimize fragility in future we'll iterate through to find the rule
         */
        if (!json.overrides) {
          return json;
        }
        for (const override of json.overrides) {
          if (!override.rules) {
            continue;
          }
          if (!override.rules[nxESLintRuleName]) {
            continue;
          }
          override.rules[nxESLintRuleName] =
            convertedRootESLintConfig.rules[nxESLintRuleName];
        }
        return json;
      }),
    ]);
  };
}

/**
 * Remove the relative extends to the root TSLint config before converting,
 * otherwise all the root config will be included inline in the project config.
 */
function removeExtendsFromProjectTSLintConfigBeforeConverting(
  projectRoot: string,
  projectTSLintJsonPath: string
): Rule {
  return updateJsonInTree(projectTSLintJsonPath, (json) => {
    if (!json.extends) {
      return json;
    }
    const extendsFromRoot = `${offsetFromRoot(projectRoot)}tslint.json`;

    if (Array.isArray(json.extends) && json.extends.length) {
      json.extends = json.extends.filter(
        (ext: string) => ext !== extendsFromRoot
      );
    }
    if (typeof json.extends === 'string' && json.extends === extendsFromRoot) {
      delete json.extends;
    }
    return json;
  });
}

/**
 * Templates and source code require different ESLint config (parsers, plugins etc), so it is
 * critical that we leverage the "overrides" capability in ESLint.
 *
 * We therefore need to split out rules which are intended for Angular Templates and apply them
 * in a dedicated config block which targets HTML files.
 */
function separateCodeAndTemplateRules(
  convertedESLintConfig: ESLintLinter.Config
) {
  const codeRules = convertedESLintConfig.rules || {};
  const templateRules: ESLintLinter.Config['rules'] = {};

  Object.keys(codeRules).forEach((ruleName) => {
    if (
      ruleName.startsWith('@angular-eslint/template') ||
      ruleName.startsWith('@angular-eslint/eslint-plugin-template')
    ) {
      templateRules[ruleName] = codeRules[ruleName];
    }
  });

  Object.keys(templateRules).forEach((ruleName) => {
    delete codeRules[ruleName];
  });

  return {
    codeRules,
    templateRules,
  };
}

function dedupeEnvAgainstConfigs(
  convertedConfig: ESLintLinter.Config,
  otherConfigs: ESLintLinter.Config[]
) {
  otherConfigs.forEach((againstConfig) => {
    updateObjPropAndRemoveDuplication(
      convertedConfig,
      againstConfig,
      'env',
      true
    );
  });
}

function dedupeRulesAgainstConfigs(
  convertedConfig: ESLintLinter.Config,
  otherConfigs: ESLintLinter.Config[]
) {
  otherConfigs.forEach((againstConfig) => {
    updateObjPropAndRemoveDuplication(
      convertedConfig,
      againstConfig,
      'rules',
      false
    );
  });
}

function dedupePluginsAgainstConfigs(
  convertedConfig: ESLintLinter.Config,
  otherConfigs: ESLintLinter.Config[]
) {
  otherConfigs.forEach((againstConfig) => {
    updateArrPropAndRemoveDuplication(
      convertedConfig,
      againstConfig,
      'plugins',
      true
    );
  });
}

/**
 * We don't want the user to depend on the TSLint fallback plugin, we will instead
 * explicitly inform them of the rules that could not be converted automatically and
 * advise them on what to do next.
 */
function warnInCaseOfUnconvertedRules(
  context: SchematicContext,
  tslintConfigPath: string,
  unconvertedTSLintRules: TSLintRuleOptions[]
): void {
  /*
   * The following rules are known to be missing from the Angular CLI equivalent TSLint
   * setup, so they will be part of our convertedRoot data:
   *
   * // FORMATTING! Please use prettier y'all!
   * "import-spacing": true
   *
   * // POSSIBLY NOT REQUIRED - typescript-eslint provides explicit-function-return-type (not yet enabled)
   * "typedef": [
   *    true,
   *    "call-signature",
   *  ]
   *
   * // FORMATTING! Please use prettier y'all!
   *  "whitespace": [
   *    true,
   *    "check-branch",
   *    "check-decl",
   *    "check-operator",
   *    "check-separator",
   *    "check-type",
   *    "check-typecast",
   *  ]
   */
  const unconvertedTSLintRuleNames = unconvertedTSLintRules
    .filter(
      (unconverted) =>
        !['import-spacing', 'whitespace', 'typedef'].includes(
          unconverted.ruleName
        )
    )
    .map((unconverted) => unconverted.ruleName);

  if (unconvertedTSLintRuleNames.length > 0) {
    context.logger.warn(
      `\nWARNING: Within "${tslintConfigPath}", the following ${unconvertedTSLintRuleNames.length} rule(s) did not have known converters in https://github.com/typescript-eslint/tslint-to-eslint-config`
    );
    context.logger.warn('\n  - ' + unconvertedTSLintRuleNames.join('\n  - '));
    context.logger.warn(
      '\nYou will need to decide on how to handle the above manually, but everything else has been handled for you automatically.\n'
    );
  }
}

function likelyContainsTSLintComment(fileContent: string): boolean {
  return fileContent.includes('tslint:');
}

function convertTSLintDisableCommentsForProject(projectRoot: string): Rule {
  return visitNotIgnoredFiles((filePath, host, context) => {
    if (!filePath.endsWith('.ts')) {
      return;
    }
    const fileContent = host.read(filePath)!.toString('utf-8');
    // Avoid updating files if we don't have to
    if (!likelyContainsTSLintComment(fileContent)) {
      return;
    }
    const updatedFileContent = convertFileComments({ fileContent, filePath });
    host.overwrite(filePath, updatedFileContent);
  }, normalize(projectRoot));
}

function ensureStringArray(val: string | string[]): string[] {
  if (typeof val === 'string') {
    return [val];
  }
  return val || [];
}
