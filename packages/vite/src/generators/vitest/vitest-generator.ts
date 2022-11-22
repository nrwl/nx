import {
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
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
    writeViteConfig(tree, {
      ...schema,
      includeVitest: true,
    });
  }

  createFiles(tree, schema, root);
  updateTsConfig(tree, schema, root);

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

function updateTsConfig(
  tree: Tree,
  options: VitestGeneratorSchema,
  projectRoot: string
) {
  updateJson(tree, joinPathFragments(projectRoot, 'tsconfig.json'), (json) => {
    if (
      json.references &&
      !json.references.some((r) => r.path === './tsconfig.spec.json')
    ) {
      json.references.push({
        path: './tsconfig.spec.json',
      });
    }

    if (options.inSourceTests) {
      (json.compilerOptions.types ??= []).push('vitest/importMap');
    }

    return json;
  });

  updateJson(tree, joinPathFragments(projectRoot, 'tsconfig.json'), (json) => {
    return json;
  });
}

function createFiles(
  tree: Tree,
  options: VitestGeneratorSchema,
  projectRoot: string
) {
  generateFiles(tree, joinPathFragments(__dirname, 'files'), projectRoot, {
    tmpl: '',
    ...options,
    projectRoot,
    offsetFromRoot: offsetFromRoot(projectRoot),
  });
}

export default vitestGenerator;
export const vitestSchematic = convertNxGenerator(vitestGenerator);
