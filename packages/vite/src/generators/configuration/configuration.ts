import {
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import {
  findExistingTargets,
  addOrChangeBuildTarget,
  addOrChangeServeTarget,
  editTsConfig,
  moveAndEditIndexHtml,
  writeViteConfig,
} from '../../utils/generator-utils';

import initGenerator from '../init/init';
import vitestGenerator from '../vitest/vitest-generator';
import { Schema } from './schema';

export async function viteConfigurationGenerator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const { targets } = readProjectConfiguration(tree, schema.project);
  let buildTarget = 'build';
  let serveTarget = 'serve';

  if (!schema.newProject) {
    buildTarget = findExistingTargets(targets).buildTarget;
    serveTarget = findExistingTargets(targets).serveTarget;
    moveAndEditIndexHtml(tree, schema, buildTarget);
    editTsConfig(tree, schema);
  }

  const initTask = await initGenerator(tree, {
    uiFramework: schema.uiFramework,
    includeLib: schema.includeLib,
  });
  tasks.push(initTask);

  addOrChangeBuildTarget(tree, schema, buildTarget);

  if (!schema.includeLib) {
    addOrChangeServeTarget(tree, schema, serveTarget);
  }

  writeViteConfig(tree, schema);

  if (schema.includeVitest) {
    const vitestTask = await vitestGenerator(tree, {
      project: schema.project,
      uiFramework: schema.uiFramework,
      inSourceTests: schema.inSourceTests,
      skipViteConfig: true,
    });
    tasks.push(vitestTask);
  }

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

export default viteConfigurationGenerator;
export const configurationSchematic = convertNxGenerator(
  viteConfigurationGenerator
);
