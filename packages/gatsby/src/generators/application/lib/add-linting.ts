import { Tree } from '@nrwl/tao/src/shared/tree';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import {
  addDependenciesToPackageJson,
  joinPathFragments,
  updateJson,
} from '@nrwl/devkit';
import { extraEslintDependencies, reactEslintJson } from '@nrwl/react';
import { NormalizedSchema } from './normalize-options';

export async function addLinting(host: Tree, options: NormalizedSchema) {
  const lintTask = await lintProjectGenerator(host, {
    linter: Linter.EsLint,
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.app.json'),
    ],
    eslintFilePatterns: [`${options.projectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
  });

  updateJson(
    host,
    joinPathFragments(options.projectRoot, '.eslintrc.json'),
    (json) => {
      json.extends = [...reactEslintJson.extends, ...json.extends];
      json.ignorePatterns = ['!**/*', 'public', '.cache'];
      json.overrides = json.overrides || [];
      json.overrides.push({
        files: ['*.tsx', '*.ts'],
        rules: {
          '@typescript-eslint/camelcase': 'off',
        },
      });
      return json;
    }
  );

  const installTask = await addDependenciesToPackageJson(
    host,
    extraEslintDependencies.dependencies,
    extraEslintDependencies.devDependencies
  );

  return runTasksInSerial(lintTask, installTask);
}
