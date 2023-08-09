import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { Linter, lintProjectGenerator } from '@nx/linter';
import { installedCypressVersion } from './cypress-version';
import { eslintPluginCypressVersion } from './versions';
import {
  addExtendsToLintConfig,
  addOverrideToLintConfig,
  findEslintFile,
  replaceOverridesInLintConfig,
} from '@nx/linter/src/generators/utils/eslint-file';

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
        eslintFilePatterns: [
          `${projectConfig.root}/**/*.${options.js ? 'js' : '{js,ts}'}`,
        ],
        setParserOptionsProject: options.setParserOptionsProject,
        skipPackageJson: options.skipPackageJson,
        rootProject: options.rootProject,
      })
    );
  }

  if (!options.linter || options.linter !== Linter.EsLint) {
    return runTasksInSerial(...tasks);
  }

  tasks.push(
    !options.skipPackageJson
      ? addDependenciesToPackageJson(
          tree,
          {},
          { 'eslint-plugin-cypress': eslintPluginCypressVersion }
        )
      : () => {}
  );

  addExtendsToLintConfig(
    tree,
    projectConfig.root,
    'plugin:cypress/recommended'
  );
  const overrides = [];
  const cyVersion = installedCypressVersion();
  if (cyVersion && cyVersion < 7) {
    /**
     * We need this override because we enabled allowJS in the tsconfig to allow for JS based Cypress tests.
     * That however leads to issues with the CommonJS Cypress plugin file.
     */
    overrides.push({
      files: [`${options.cypressDir}/plugins/index.js`],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-undef': 'off',
      },
    });
  }

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
    overrides.forEach((override) =>
      addOverrideToLintConfig(tree, projectConfig.root, override)
    );
  }

  return runTasksInSerial(...tasks);
}
