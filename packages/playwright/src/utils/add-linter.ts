import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { Linter, lintProjectGenerator } from '@nx/eslint';
import { javaScriptOverride } from '@nx/eslint/src/generators/init/global-eslint-config';
import { eslintPluginPlaywrightVersion } from './versions';
import {
  addExtendsToLintConfig,
  addOverrideToLintConfig,
  addPluginsToLintConfig,
  findEslintFile,
  isEslintConfigSupported,
} from '@nx/eslint/src/generators/utils/eslint-file';

export interface PlaywrightLinterOptions {
  project: string;
  linter: Linter;
  setParserOptionsProject: boolean;
  skipPackageJson: boolean;
  rootProject: boolean;
  js?: boolean;
  /**
   * Directory from the project root, where the playwright files will be located.
   **/
  directory: string;
  addPlugin?: boolean;
}

export async function addLinterToPlaywrightProject(
  tree: Tree,
  options: PlaywrightLinterOptions
): Promise<GeneratorCallback> {
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

  tasks.push(
    !options.skipPackageJson
      ? addDependenciesToPackageJson(
          tree,
          {},
          { 'eslint-plugin-playwright': eslintPluginPlaywrightVersion }
        )
      : () => {}
  );

  if (
    isEslintConfigSupported(tree, projectConfig.root) ||
    isEslintConfigSupported(tree)
  ) {
    addExtendsToLintConfig(
      tree,
      projectConfig.root,
      'plugin:playwright/recommended'
    );
    if (options.rootProject) {
      addPluginsToLintConfig(tree, projectConfig.root, '@nx');
      addOverrideToLintConfig(tree, projectConfig.root, javaScriptOverride);
    }
    addOverrideToLintConfig(tree, projectConfig.root, {
      files: [`${options.directory}/**/*.{ts,js,tsx,jsx}`],
      parserOptions: !options.setParserOptionsProject
        ? undefined
        : {
            project: `${projectConfig.root}/tsconfig.*?.json`,
          },
      rules: {},
    });
  }

  return runTasksInSerial(...tasks);
}
