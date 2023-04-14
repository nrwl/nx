import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { Linter, lintProjectGenerator } from '@nx/linter';
import { mapLintPattern } from '@nx/linter/src/generators/lint-project/lint-project';
import { addAngularEsLintDependencies } from './lib/add-angular-eslint-dependencies';
import { extendAngularEslintJson } from './lib/create-eslint-configuration';
import type { AddLintingGeneratorSchema } from './schema';

export async function addLintingGenerator(
  tree: Tree,
  options: AddLintingGeneratorSchema
): Promise<GeneratorCallback> {
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
    const installTask = addAngularEsLintDependencies(tree);
    tasks.push(installTask);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default addLintingGenerator;
