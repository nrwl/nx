import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  glob,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import * as path from 'path';
import { AddInputsGeneratorSchema } from './schema';
import { join, relative } from 'path';

export async function addInputsGenerator(
  tree: Tree,
  options: AddInputsGeneratorSchema
) {
  const e2eProjects = tree.children('e2e');

  const macProjects = new Set(['react-native', 'detox', 'expo']);

  for (const e2eProj of e2eProjects) {
    const targetPrefix = macProjects.has(e2eProj)
      ? 'e2e-macos-ci--'
      : 'e2e-ci--';

    const { name } = readJson(tree, join('e2e', e2eProj, 'project.json'));
    const proj = readProjectConfiguration(tree, name);

    const tests = glob(tree, [join('e2e', e2eProj, 'src', '**/*.test.ts')]);
    for (const test of tests) {
      proj.targets[`${targetPrefix}${relative(join('e2e', e2eProj), test)}`] = {
        inputs: ['e2eInputs', '^production'],
      };
    }
    console.log(proj);
    updateProjectConfiguration(tree, name, proj);
  }
  await formatFiles(tree);
}

export default addInputsGenerator;
