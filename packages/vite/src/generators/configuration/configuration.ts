import {
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import {
  findServeAndBuildTargets,
  addOrChangeBuildTarget,
  addOrChangeServeTarget,
  editTsConfig,
  moveAndEditIndexHtml,
  writeViteConfig,
} from '../../utils/generator-utils';

import initGenerator from '../init/init';
import { Schema } from './schema';

export async function viteConfigurationGenerator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const { targets } = readProjectConfiguration(tree, schema.project);
  let buildTarget = 'build';
  let serveTarget = 'serve';

  if (!schema.newProject) {
    buildTarget = findServeAndBuildTargets(targets).buildTarget;
    serveTarget = findServeAndBuildTargets(targets).serveTarget;
    moveAndEditIndexHtml(tree, schema, buildTarget);
    editTsConfig(tree, schema);
  }

  const initTask = await initGenerator(tree, {
    uiFramework: schema.uiFramework,
  });
  tasks.push(initTask);

  addOrChangeBuildTarget(tree, schema, buildTarget);
  addOrChangeServeTarget(tree, schema, serveTarget);
  writeViteConfig(tree, schema);

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

export default viteConfigurationGenerator;
export const configurationSchematic = convertNxGenerator(
  viteConfigurationGenerator
);
