import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { LinterType } from '@nx/js';
import {
  javaScriptOverride,
  addExtendsToLintConfig,
  addOverrideToLintConfig,
  addPluginsToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  addTypedLintingToFlatConfig,
  findEslintFile,
  isEslintConfigSupported,
  isTypedLintingEnabled,
  useFlatConfig,
} from '@nx/eslint/internal';
import { eslintPluginPlaywrightVersion } from './versions';
import { addLintingToProject } from '@nx/js/internal';

export interface PlaywrightLinterOptions {
  project: string;
  linter: LinterType;
  enableTypedLinting?: boolean;
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
  setParserOptionsProject?: boolean;
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
  const enableTypedLinting = isTypedLintingEnabled(options);

  // An existing ESLint config means the project is already registered, so skip
  // straight to the Playwright-specific shaping below.
  if (options.linter !== 'eslint' || !eslintFile) {
    tasks.push(
      await addLintingToProject(tree, {
        project: options.project,
        linter: options.linter,
        tsConfigPaths: [joinPathFragments(projectConfig.root, 'tsconfig.json')],
        enableTypedLinting,
        skipPackageJson: options.skipPackageJson,
        rootProject: options.rootProject,
        addPlugin: options.addPlugin,
      })
    );
  }

  // Everything below configures ESLint — predefined configs, `extends`, ignore
  // entries — which have no equivalent in other linters.
  if (options.linter !== 'eslint') {
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
      // `lintProjectGenerator` only runs when the project has no ESLint config
      // (it already emits the projectService block in that case). For an
      // existing flat config it didn't run, so emit the block here when typed
      // linting is requested.
      if (eslintFile && enableTypedLinting) {
        addTypedLintingToFlatConfig(tree, projectConfig.root);
      }
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
        parserOptions: enableTypedLinting
          ? { project: `${projectConfig.root}/tsconfig.*?.json` }
          : undefined,
        rules: {},
      });
    }
  }

  return runTasksInSerial(...tasks);
}
