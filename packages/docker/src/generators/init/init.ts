import {
  type Tree,
  type GeneratorCallback,
  readNxJson,
  createProjectGraphAsync,
  addDependenciesToPackageJson,
  formatFiles,
  runTasksInSerial,
  logger,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { InitGeneratorSchema } from './schema';
import { createNodesV2 } from '../../plugins/plugin';
import { nxVersion } from '../../utils/versions';

export function updateDependencies(tree: Tree, schema: InitGeneratorSchema) {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/docker': nxVersion,
    },
    undefined,
    schema.keepExistingVersions
  );
}

export async function initGenerator(tree: Tree, schema: InitGeneratorSchema) {
  logger.warn(
    `Docker support is experimental. Breaking changes may occur and not adhere to semver versioning.`
  );
  const nxJson = readNxJson(tree);

  await addPlugin(
    tree,
    await createProjectGraphAsync(),
    '@nx/docker',
    createNodesV2,
    {
      buildTarget: ['docker:build', 'docker-build', 'build-docker'],
      runTarget: ['docker:run', 'docker-run', 'run-docker'],
    },
    schema.updatePackageScripts
  );

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson) {
    tasks.push(updateDependencies(tree, schema));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
