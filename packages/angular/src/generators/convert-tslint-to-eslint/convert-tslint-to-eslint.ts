import { conversionGenerator as cypressConversionGenerator } from '@nrwl/cypress';
import {
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  logger,
  Tree,
} from '@nrwl/devkit';
import { ConvertTSLintToESLintSchema, ProjectConverter } from '@nrwl/linter';
import type { Linter } from 'eslint';
import { addLintingGenerator } from '../add-linting/add-linting';

export async function conversionGenerator(
  host: Tree,
  options: ConvertTSLintToESLintSchema
) {
  /**
   * The ProjectConverter instance encapsulates all the standard operations we need
   * to perform in order to convert a project from TSLint to ESLint, as well as some
   * extensibility points for adjusting the behavior on a per package basis.
   *
   * E.g. @nrwl/angular projects might need to make different changes to the final
   * ESLint config when compared with @nrwl/next projects.
   *
   * See the ProjectConverter implementation for a full breakdown of what it does.
   */
  const projectConverter = new ProjectConverter({
    host,
    projectName: options.project,
    ignoreExistingTslintConfig: options.ignoreExistingTslintConfig,
    eslintInitializer: async ({ projectName, projectConfig }) => {
      await addLintingGenerator(host, {
        projectName,
        projectRoot: projectConfig.root,
        prefix: (projectConfig as any).prefix || 'app',
        /**
         * We set the parserOptions.project config just in case the converted config uses
         * rules which require type-checking. Later in the conversion we check if it actually
         * does and remove the config again if it doesn't, so that it is most efficient.
         */
        setParserOptionsProject: true,
        skipFormat: options.skipFormat,
      });
    },
  });

  /**
   * If root eslint configuration already exists it will not be recreated
   * but we also don't want to re-run the tslint config conversion
   * as it was likely already done
   */
  const rootEslintConfigExists = host.exists('.eslintrc.json');
  /**
   * Create the standard (which is applicable to the current package) ESLint setup
   * for converting the project.
   */
  const eslintInitInstallTask = await projectConverter.initESLint();

  /**
   * Convert the root tslint.json and apply the converted rules to the root .eslintrc.json
   */
  const rootConfigInstallTask = await projectConverter.convertRootTSLintConfig(
    (json) => {
      json.overrides = [
        { files: ['*.ts'], rules: {} },
        { files: ['*.html'], rules: {} },
      ];
      return applyAngularRulesToCorrectOverrides(json);
    },
    rootEslintConfigExists
  );

  /**
   * Convert the project's tslint.json to an equivalent ESLint config.
   */
  const projectConfigInstallTask = await projectConverter.convertProjectConfig(
    (json) => applyAngularRulesToCorrectOverrides(json)
  );
  /**
   * Clean up the original TSLint configuration for the project.
   */
  projectConverter.removeProjectTSLintFile();

  // Only project shouldn't be added as a default
  const { project, ...defaults } = options;

  /**
   * Store user preferences for the collection
   */
  projectConverter.setDefaults('@nrwl/angular', defaults);

  /**
   * If the Angular project is an app which has an e2e project, try and convert that as well.
   */
  let cypressInstallTask: GeneratorCallback = () => Promise.resolve(undefined);
  const e2eProjectName = projectConverter.getE2EProjectName();
  if (e2eProjectName) {
    try {
      cypressInstallTask = await cypressConversionGenerator(host, {
        project: e2eProjectName,
        ignoreExistingTslintConfig: options.ignoreExistingTslintConfig,
        /**
         * We can always set this to false, because it will already be handled by the next
         * step of this parent generator, if applicable
         */
        removeTSLintIfNoMoreTSLintTargets: false,
        skipFormat: options.skipFormat,
      });
    } catch {
      logger.warn(
        'This Angular app has an e2e project, but it was not possible to convert it from TSLint to ESLint. This could be because the e2e project did not have a tslint.json file to begin with.'
      );
    }
  }

  /**
   * Based on user preference and remaining usage, remove TSLint from the workspace entirely.
   */
  let uninstallTSLintTask: GeneratorCallback = () => Promise.resolve(undefined);
  if (
    options.removeTSLintIfNoMoreTSLintTargets &&
    !projectConverter.isTSLintUsedInWorkspace()
  ) {
    uninstallTSLintTask = projectConverter.removeTSLintFromWorkspace();
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return async () => {
    await eslintInitInstallTask();
    await rootConfigInstallTask();
    await projectConfigInstallTask();
    await cypressInstallTask();
    await uninstallTSLintTask();
  };
}

export const conversionSchematic = convertNxGenerator(conversionGenerator);

/**
 * In the case of Angular lint rules, we need to apply them to correct override depending upon whether
 * or not they require @typescript-eslint/parser or @angular-eslint/template-parser in order to function.
 *
 * By this point, the applicable overrides have already been scaffolded for us by the Nx generators
 * that ran earlier within this generator.
 */
function applyAngularRulesToCorrectOverrides(
  json: Linter.Config
): Linter.Config {
  const rules = json.rules;

  if (rules && Object.keys(rules).length) {
    for (const [ruleName, ruleConfig] of Object.entries(rules)) {
      for (const override of json.overrides) {
        if (
          override.files.includes('*.html') &&
          ruleName.startsWith('@angular-eslint/template')
        ) {
          // Prioritize the converted rules over any base implementations from the original Nx generator
          override.rules[ruleName] = ruleConfig;
        }

        /**
         * By default, tslint-to-eslint-config will try and apply any rules without known converters
         * by using eslint-plugin-tslint. We instead explicitly warn the user about this missing converter,
         * and therefore at this point we strip out any rules which start with @typescript-eslint/tslint/config
         */
        if (
          override.files.includes('*.ts') &&
          !ruleName.startsWith('@angular-eslint/template')
        ) {
          // Prioritize the converted rules over any base implementations from the original Nx generator
          override.rules[ruleName] = ruleConfig;
        }
      }
    }
  }

  // It's possible that there are plugins to apply to the TS override
  if (json.plugins) {
    for (const override of json.overrides) {
      if (override.files.includes('*.ts')) {
        override.plugins = override.plugins || [];
        override.plugins = [
          ...override.plugins,
          ...json.plugins.filter(
            (plugin) => plugin !== '@angular-eslint/eslint-plugin-template'
          ),
        ];
      }

      if (
        override.files.includes('*.html') &&
        json.plugins.includes('@angular-eslint/eslint-plugin-template')
      ) {
        override.plugins = ['@angular-eslint/eslint-plugin-template'];
      }
    }
    delete json.plugins;
  }

  /**
   * We now no longer need the flat list of rules at the root of the config
   * because they have all been applied to an appropriate override.
   */
  delete json.rules;
  return json;
}
