import {
  GeneratorCallback,
  joinPathFragments,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { mapLintPattern } from '@nrwl/linter/src/generators/lint-project/lint-project';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { join } from 'path';
import { getGeneratorDirectoryForInstalledAngularVersion } from '../utils/version-utils';
import { addAngularEsLintDependencies } from './lib/add-angular-eslint-dependencies';
import { extendAngularEslintJson } from './lib/create-eslint-configuration';
import type { AddLintingGeneratorSchema } from './schema';

export async function addLintingGenerator(
  tree: Tree,
  options: AddLintingGeneratorSchema
): Promise<GeneratorCallback> {
  const generatorDirectory =
    getGeneratorDirectoryForInstalledAngularVersion(tree);
  if (generatorDirectory) {
    let previousGenerator = await import(
      join(__dirname, generatorDirectory, 'add-linting')
    );
    await previousGenerator.default(tree, options);
    return;
  }

  const tasks: GeneratorCallback[] = [];
  const rootProject = options.projectRoot === '.' || options.projectRoot === '';
  const lintTask = await lintProjectGenerator(tree, {
    linter: Linter.EsLint,
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.app.json'),
    ],
    unitTestRunner: options.unitTestRunner,
    eslintFilePatterns: [
      mapLintPattern(options.projectRoot, 'ts', rootProject),
      mapLintPattern(options.projectRoot, 'html', rootProject),
    ],
    setParserOptionsProject: options.setParserOptionsProject,
    skipFormat: true,
    rootProject: rootProject,
  });
  tasks.push(lintTask);

  updateJson(
    tree,
    joinPathFragments(options.projectRoot, '.eslintrc.json'),
    (json) => extendAngularEslintJson(json, options)
  );

  if (!options.skipPackageJson) {
    const installTask = await addAngularEsLintDependencies(tree);
    tasks.push(installTask);
  }

  return runTasksInSerial(...tasks);
}

export default addLintingGenerator;
