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

  const { targets, projectType } = readProjectConfiguration(
    tree,
    schema.project
  );
  let buildTargetName = 'build';
  let serveTargetName = 'serve';

  schema.includeLib ??= projectType === 'library';

  if (!schema.newProject) {
    const { buildTarget, serveTarget, unsuppored } =
      findExistingTargets(targets);

    /**
     * Here, we make sure that the project has a build target
     * and it is unsupported, before throwing the error.
     * The reason is that the project could not have a build
     * target at all, in which case we don't want to throw.
     * Or the project can have multiple build targets, one of which unsupported.
     * In that case, we convert the supported one.
     */
    if (!buildTarget && unsuppored) {
      throw new Error(
        `The project ${schema.project} cannot be converted to use the @nrwl/vite executors.`
      );
    }

    buildTargetName = buildTarget ?? buildTargetName;
    serveTargetName = serveTarget ?? serveTargetName;

    if (projectType === 'application') {
      moveAndEditIndexHtml(tree, schema, buildTargetName);
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
