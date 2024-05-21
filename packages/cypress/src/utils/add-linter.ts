import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { Linter, lintProjectGenerator } from '@nx/eslint';
import { installedCypressVersion } from './cypress-version';
import { eslintPluginCypressVersion } from './versions';
import {
  addExtendsToLintConfig,
  addOverrideToLintConfig,
  addPluginsToLintConfig,
  findEslintFile,
  isEslintConfigSupported,
  replaceOverridesInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';
import {
  javaScriptOverride,
  typeScriptOverride,
} from '@nx/eslint/src/generators/init/global-eslint-config';

export interface CyLinterOptions {
  project: string;
  linter: Linter;
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
  if (options.linter === Linter.None) {
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
        setParserOptionsProject: options.setParserOptionsProject,
        skipPackageJson: options.skipPackageJson,
        rootProject: options.rootProject,
        addPlugin: options.addPlugin,
      })
    );
  }

  if (!options.linter || options.linter !== Linter.EsLint) {
    return runTasksInSerial(...tasks);
  }

  options.overwriteExisting = options.overwriteExisting || !eslintFile;

  tasks.push(
    !options.skipPackageJson
      ? addDependenciesToPackageJson(
          tree,
          {},
          { 'eslint-plugin-cypress': eslintPluginCypressVersion }
        )
      : () => {}
  );

  if (
    isEslintConfigSupported(tree, projectConfig.root) ||
    isEslintConfigSupported(tree)
  ) {
    const overrides = [];
    if (options.rootProject) {
      addPluginsToLintConfig(tree, projectConfig.root, '@nx');
      overrides.push(typeScriptOverride);
      overrides.push(javaScriptOverride);
    }
    addExtendsToLintConfig(
      tree,
      projectConfig.root,
      'plugin:cypress/recommended'
    );
    const cyVersion = installedCypressVersion();
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
    const addCy6Override = cyVersion && cyVersion < 7;

    if (options.overwriteExisting) {
      overrides.unshift({
        files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        parserOptions: !options.setParserOptionsProject
          ? undefined
          : {
              project: `${projectConfig.root}/tsconfig.*?.json`,
            },
        rules: {},
      });
      if (addCy6Override) {
        overrides.push(cy6Override);
      }
      replaceOverridesInLintConfig(tree, projectConfig.root, overrides);
    } else {
      overrides.unshift({
        files: [
          '*.cy.{ts,js,tsx,jsx}',
          `${options.cypressDir}/**/*.{ts,js,tsx,jsx}`,
        ],
        parserOptions: !options.setParserOptionsProject
          ? undefined
          : {
              project: `${projectConfig.root}/tsconfig.*?.json`,
            },
        rules: {},
      });
      if (addCy6Override) {
        overrides.push(cy6Override);
      }
      overrides.forEach((override) =>
        addOverrideToLintConfig(tree, projectConfig.root, override)
      );
    }
  }

  return runTasksInSerial(...tasks);
}
