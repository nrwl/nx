import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { Linter, lintProjectGenerator } from '@nx/linter';
import { globalJavaScriptOverrides } from '@nx/linter/src/generators/init/global-eslint-config';
import { eslintPluginPlaywrightVersion } from './versions';

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

  if (!tree.exists(joinPathFragments(projectConfig.root, '.eslintrc.json'))) {
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
          { 'eslint-plugin-playwright': eslintPluginPlaywrightVersion }
        )
      : () => {}
  );

  updateJson(
    tree,
    joinPathFragments(projectConfig.root, '.eslintrc.json'),
    (json) => {
      if (options.rootProject) {
        json.plugins = ['@nx'];
        json.extends = ['plugin:playwright/recommended'];
      } else {
        json.extends = ['plugin:playwright/recommended', ...json.extends];
      }
      json.overrides ??= [];
      const globals = options.rootProject ? [globalJavaScriptOverrides] : [];
      const override = {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        parserOptions: !options.setParserOptionsProject
          ? undefined
          : {
              project: `${projectConfig.root}/tsconfig.*?.json`,
            },
        rules: {},
      };
      const palywrightFiles = [
        {
          ...override,
          files: [`${options.directory}/**/*.{ts,js,tsx,jsx}`],
        },
      ];
      json.overrides.push(...globals);
      json.overrides.push(...palywrightFiles);
      return json;
    }
  );

  return runTasksInSerial(...tasks);
}
