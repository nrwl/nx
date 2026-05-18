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
  addExtendsToLintConfig,
  addOverrideToLintConfig,
  addPluginsToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  findEslintFile,
  isEslintConfigSupported,
  isTypedLintingEnabled,
  useFlatConfig,
} from '@nx/eslint/internal';
import { eslintPluginPlaywrightVersion } from './versions';

export interface PlaywrightLinterOptions {
  project: string;
  linter: Linter | LinterType;
  enableTypedLinting?: boolean;
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in v24.
   */
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
        enableTypedLinting: options.enableTypedLinting,
        setParserOptionsProject: options.setParserOptionsProject,
        skipPackageJson: options.skipPackageJson,
        rootProject: options.rootProject,
        addPlugin: options.addPlugin,
      })
    );
  }

  if (!options.linter || options.linter !== 'eslint') {
    return runTasksInSerial(...tasks);
  }

  tasks.push(
    !options.skipPackageJson
      ? addDependenciesToPackageJson(
          tree,
          {},
          { 'eslint-plugin-playwright': eslintPluginPlaywrightVersion },
          undefined,
          true
        )
      : () => {}
  );

  if (
    isEslintConfigSupported(tree, projectConfig.root) ||
    isEslintConfigSupported(tree)
  ) {
    if (useFlatConfig(tree)) {
      addPredefinedConfigToFlatLintConfig(
        tree,
        projectConfig.root,
        'flat/recommended',
        {
          moduleName: 'playwright',
          moduleImportPath: 'eslint-plugin-playwright',
          spread: false,
          insertAtTheEnd: false,
        }
      );
      addOverrideToLintConfig(tree, projectConfig.root, {
        files: ['*.ts', '*.js'],
        rules: {},
      });
    } else {
      const addExtendsTask = addExtendsToLintConfig(
        tree,
        projectConfig.root,
        'plugin:playwright/recommended'
      );
      tasks.push(addExtendsTask);

      if (options.rootProject) {
        addPluginsToLintConfig(tree, projectConfig.root, '@nx');
        addOverrideToLintConfig(tree, projectConfig.root, javaScriptOverride);
      }
      addOverrideToLintConfig(tree, projectConfig.root, {
        files: [`${options.directory}/**/*.{ts,js,tsx,jsx}`],
        // Only emit `parserOptions.project` here on the legacy `.eslintrc`
        // stack. Flat configs use `parserOptions.projectService` emitted by
        // `lintProjectGenerator`.
        parserOptions: isTypedLintingEnabled(options)
          ? { project: `${projectConfig.root}/tsconfig.*?.json` }
          : undefined,
        rules: {},
      });
    }
  }

  return runTasksInSerial(...tasks);
}
