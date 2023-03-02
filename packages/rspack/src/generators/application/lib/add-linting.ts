import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { mapLintPattern } from '@nrwl/linter/src/generators/lint-project/lint-project';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import type * as eslint from 'eslint';

import {
  eslintPluginImportVersion,
  eslintPluginJsxA11yVersion,
  eslintPluginReactHooksVersion,
  eslintPluginReactVersion,
} from '../../../utils/versions';
import { NormalizedSchema } from '../schema';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  const tasks: GeneratorCallback[] = [];
  const lintTask = await lintProjectGenerator(host, {
    linter: Linter.EsLint,
    project: options.name,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
    unitTestRunner: options.unitTestRunner,
    eslintFilePatterns: [
      mapLintPattern(
        options.appProjectRoot,
        '{ts,tsx,js,jsx}',
        options.rootProject
      ),
    ],
    skipFormat: true,
    rootProject: options.rootProject,
  });
  tasks.push(lintTask);

  updateJson(
    host,
    joinPathFragments(options.appProjectRoot, '.eslintrc.json'),
    extendReactEslintJson
  );

  const installTask = await addDependenciesToPackageJson(
    host,
    {},
    {
      'eslint-plugin-import': eslintPluginImportVersion,
      'eslint-plugin-jsx-a11y': eslintPluginJsxA11yVersion,
      'eslint-plugin-react': eslintPluginReactVersion,
      'eslint-plugin-react-hooks': eslintPluginReactHooksVersion,
    }
  );
  tasks.push(installTask);

  return runTasksInSerial(...tasks);
}

function extendReactEslintJson(json: eslint.Linter.Config) {
  const { extends: pluginExtends, ...config } = json;
  return {
    extends: ['plugin:@nrwl/nx/react', ...(pluginExtends || [])],
    ...config,
  };
}
