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
  addTypedLintingToFlatConfig,
  findEslintFile,
  isEslintConfigSupported,
  isTypedLintingEnabled,
  useFlatConfig,
} from '@nx/eslint/internal';
import { eslintPluginPlaywrightVersion } from './versions';
import { addLintingToProject } from '@nx/js';

export interface PlaywrightLinterOptions {
  project: string;
  linter: Linter | LinterType;
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
  // Everything below configures ESLint — predefined configs, `extends`,
  // ignore entries — which have no equivalent in other linters. They only
  // need the linter registering, which the helper handles (including `none`).
  if (options.linter !== 'eslint') {
    return addLintingToProject(tree, {
      linter: options.linter as any,
      project: options.project,
      addPlugin: options.addPlugin,
      skipPackageJson: options.skipPackageJson,
    });
  }

  const tasks: GeneratorCallback[] = [];
  const projectConfig = readProjectConfiguration(tree, options.project);

  const eslintFile = findEslintFile(tree, projectConfig.root);
  const enableTypedLinting = isTypedLintingEnabled(options);
  if (!eslintFile) {
    tasks.push(
      await lintProjectGenerator(tree, {
        project: options.project,
        linter: options.linter,
        skipFormat: true,
        tsConfigPaths: [joinPathFragments(projectConfig.root, 'tsconfig.json')],
        enableTypedLinting,
        skipPackageJson: options.skipPackageJson,
        rootProject: options.rootProject,
        addPlugin: options.addPlugin,
      })
    );
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
