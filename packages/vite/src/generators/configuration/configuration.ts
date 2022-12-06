import {
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  logger,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import {
  addOrChangeBuildTarget,
  addOrChangeServeTarget,
  editTsConfig,
  moveAndEditIndexHtml,
  writeViteConfig,
  getTargetNames,
} from '../../utils/generator-utils';

import initGenerator from '../init/init';
import vitestGenerator from '../vitest/vitest-generator';
import { Schema } from './schema';

export async function viteConfigurationGenerator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const { projectType } = readProjectConfiguration(tree, schema.project);
  let buildTargetName = 'build';
  let serveTargetName = 'serve';

  schema.includeLib ??= projectType === 'library';

  if (!schema.newProject) {
    let { buildTarget, serveTarget } = getTargetNames(tree, schema.project);

    // TODO(katerina): Maybe add warning if project cannot be converted to vite (eg. angular or something else)?
    if (!buildTarget) {
      logger.warn(
        `Could not find build target that can be converted to @nrwl/vite for project ${schema.project}. 
        Nx will create a new build target.`
      );
    }

    if (!serveTarget) {
      logger.warn(
        `Could not find serve target that can be converted to @nrwl/vite for project ${schema.project}.
        Nx will create a new serve target.`
      );
    }

    buildTargetName = buildTarget ?? 'build';
    serveTargetName = serveTarget ?? serveTargetName;

    if (projectType === 'application') {
      moveAndEditIndexHtml(tree, schema, buildTarget);
    }
    editTsConfig(tree, schema);
  }

  const initTask = await initGenerator(tree, {
    uiFramework: schema.uiFramework,
    includeLib: schema.includeLib,
  });
  tasks.push(initTask);

  addOrChangeBuildTarget(tree, schema, buildTargetName);

  if (!schema.includeLib) {
    addOrChangeServeTarget(tree, schema, serveTargetName);
  }

  writeViteConfig(tree, schema);

  if (schema.includeVitest) {
    const vitestTask = await vitestGenerator(tree, {
      project: schema.project,
      uiFramework: schema.uiFramework,
      inSourceTests: schema.inSourceTests,
      coverageProvider: 'c8',
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
