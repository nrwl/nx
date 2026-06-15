import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { Linter, LinterType, lintProjectGenerator } from '@nx/eslint';
import {
  javaScriptOverride,
  typeScriptOverride,
  addExtendsToLintConfig,
  addOverrideToLintConfig,
  addPluginsToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  addTypedLintingToFlatConfig,
  findEslintFile,
  isEslintConfigSupported,
  isTypedLintingEnabled,
  replaceOverridesInLintConfig,
  useFlatConfig,
} from '@nx/eslint/internal';
import { versions } from './versions';

export interface CyLinterOptions {
  project: string;
  linter: Linter | LinterType;
  enableTypedLinting?: boolean;
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in v24.
   */
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  rootProject?: boolean;
  js?: boolean;
  /**
   * Directory from the project root, where the cypress files will be located.
   * typically src/ or cypress/
   **/
  cypressDir: string;
  /**
   * overwrite existing eslint rules for the cypress defaults
   * This is useful when adding linting to a brand new project vs an existing one
   **/
  overwriteExisting?: boolean;
  addPlugin?: boolean;
}

export async function addLinterToCyProject(
  tree: Tree,
  options: CyLinterOptions
) {
  if (options.linter === 'none') {
    return () => {};
  }

  const tasks: GeneratorCallback[] = [];
  const projectConfig = readProjectConfiguration(tree, options.project);

  const eslintFile = findEslintFile(tree, projectConfig.root);
  if (!eslintFile) {
    tasks.push(
      await lintProjectGenerator(tree, {
        project: options.project,
        linter: options.linter,
        skipFormat: true,
        tsConfigPaths: [joinPathFragments(projectConfig.root, 'tsconfig.json')],
        enableTypedLinting: isTypedLintingEnabled(options),
        skipPackageJson: options.skipPackageJson,
        rootProject: options.rootProject,
        addPlugin: options.addPlugin,
      })
    );
  }

  if (!options.linter || options.linter !== 'eslint') {
    return runTasksInSerial(...tasks);
  }

  options.overwriteExisting = options.overwriteExisting || !eslintFile;

  if (!options.skipPackageJson) {
    const pkgVersions = versions(tree);

    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        { 'eslint-plugin-cypress': pkgVersions.eslintPluginCypressVersion },
        undefined,
        true
      )
    );
  }

  if (
    isEslintConfigSupported(tree, projectConfig.root) ||
    isEslintConfigSupported(tree)
  ) {
    const overrides = [];
    if (useFlatConfig(tree)) {
      addPredefinedConfigToFlatLintConfig(
        tree,
        projectConfig.root,
        'recommended',
        {
          moduleName: 'cypress',
          moduleImportPath: 'eslint-plugin-cypress/flat',
          spread: false,
          insertAtTheEnd: false,
        }
      );
      addOverrideToLintConfig(tree, projectConfig.root, {
        files: ['*.ts', '*.js'],
        rules: {},
      });
    } else {
      if (options.rootProject) {
        addPluginsToLintConfig(tree, projectConfig.root, '@nx');
        overrides.push(typeScriptOverride);
        overrides.push(javaScriptOverride);
      }
      const addExtendsTask = addExtendsToLintConfig(
        tree,
        projectConfig.root,
        'plugin:cypress/recommended'
      );
      tasks.push(addExtendsTask);
    }
    /**
     * We need this override because we enabled allowJS in the tsconfig to allow for JS based Cypress tests.
     * That however leads to issues with the CommonJS Cypress plugin file.
     */
    const cy6Override = {
      files: [`${options.cypressDir}/plugins/index.js`],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-undef': 'off',
      },
    };

    // For flat configs typed linting is handled by `lintProjectGenerator` via
    // `parserOptions.projectService`, so we don't emit `parserOptions.project`
    // here. For legacy `.eslintrc` configs, fall back to the typescript-eslint
    // v7 shape that the legacy stack supports.
    const enableTypedLinting = isTypedLintingEnabled(options);
    const legacyParserOptions =
      !useFlatConfig(tree) && enableTypedLinting
        ? { project: `${projectConfig.root}/tsconfig.*?.json` }
        : undefined;
    if (options.overwriteExisting) {
      overrides.unshift({
        files: useFlatConfig(tree)
          ? // For flat configs we don't need to specify the files
            undefined
          : ['*.ts', '*.tsx', '*.js', '*.jsx'],
        parserOptions: legacyParserOptions,
        rules: {},
      });
      replaceOverridesInLintConfig(tree, projectConfig.root, overrides);
      // `replaceOverridesInLintConfig` strips all file-scoped overrides in flat
      // configs, including the typed-linting block emitted by
      // `lintProjectGenerator`. Re-add it when typed linting is enabled.
      if (useFlatConfig(tree) && enableTypedLinting) {
        addTypedLintingToFlatConfig(tree, projectConfig.root);
      }
    } else {
      overrides.unshift({
        files: useFlatConfig(tree)
          ? // For flat configs we don't need to specify the files
            undefined
          : [
              '*.cy.{ts,js,tsx,jsx}',
              `${options.cypressDir}/**/*.{ts,js,tsx,jsx}`,
            ],
        parserOptions: legacyParserOptions,
        rules: {},
      });
      overrides.forEach((override) =>
        addOverrideToLintConfig(tree, projectConfig.root, override)
      );
      // When cypress is added to an existing eslint config (lintProjectGenerator
      // didn't run because the file already existed), the projectService block
      // isn't there yet, so add it ourselves.
      if (useFlatConfig(tree) && enableTypedLinting) {
        addTypedLintingToFlatConfig(tree, projectConfig.root);
      }
    }
  }

  return runTasksInSerial(...tasks);
}
