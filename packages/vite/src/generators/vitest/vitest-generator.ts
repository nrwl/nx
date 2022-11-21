import {
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import {
  addOrChangeTestTarget,
  findExistingTargets,
  writeViteConfig,
} from '../../utils/generator-utils';
import { VitestGeneratorSchema } from './schema';

import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import initGenerator from '../init/init';

export async function vitestGenerator(
  tree: Tree,
  schema: VitestGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];

  const { targets, root } = readProjectConfiguration(tree, schema.project);
  let testTarget = findExistingTargets(targets).testTarget;

  addOrChangeTestTarget(tree, schema, testTarget);

  const initTask = await initGenerator(tree, {
    uiFramework: schema.uiFramework,
  });
  tasks.push(initTask);

  if (!schema.skipViteConfig) {
    writeViteConfig(tree, schema);
  }

  // TODO create tsconfig.spec.json and make sure to add to tsconfig.json
  updateTsConfig(tree, schema, root);

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

function updateTsConfig(
  tree: Tree,
  options: VitestGeneratorSchema,
  projectRoot: string
) {
  if (!options.inSourceTests) {
    return;
  }
  updateJson(tree, joinPathFragments(projectRoot, 'tsconfig.json'), (json) => {
    (json.compilerOptions.types ??= []).push('vitest/importMap');
    return json;
  });
}

export default vitestGenerator;
export const vitestSchematic = convertNxGenerator(vitestGenerator);
