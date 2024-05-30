import {
  addDependenciesToPackageJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  type GeneratorCallback,
  type Tree,
  readNxJson,
  createProjectGraphAsync,
} from '@nx/devkit';
import { addPluginV1 } from '@nx/devkit/src/utils/add-plugin';
import { reactDomVersion, reactVersion } from '@nx/react/src/utils/versions';
import { addGitIgnoreEntry } from '../../utils/add-gitignore-entry';
import { nextVersion, nxVersion } from '../../utils/versions';
import type { InitSchema } from './schema';

function updateDependencies(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(removeDependenciesFromPackageJson(host, ['@nx/next'], []));

  tasks.push(
    addDependenciesToPackageJson(
      host,
      {
        next: nextVersion,
        react: reactVersion,
        'react-dom': reactDomVersion,
      },
      {
        '@nx/next': nxVersion,
      },
      undefined,
      schema.keepExistingVersions
    )
  );

  return runTasksInSerial(...tasks);
}

export function nextInitGenerator(tree: Tree, schema: InitSchema) {
  return nextInitGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function nextInitGeneratorInternal(
  host: Tree,
  schema: InitSchema
) {
  const nxJson = readNxJson(host);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  schema.addPlugin ??= addPluginDefault;
  if (schema.addPlugin) {
    const { createNodes } = await import('../../plugins/plugin');
    await addPluginV1(
      host,
      await createProjectGraphAsync(),
      '@nx/next/plugin',
      createNodes,
      {
        startTargetName: ['start', 'next:start', 'next-start'],
        buildTargetName: ['build', 'next:build', 'next-build'],
        devTargetName: ['dev', 'next:dev', 'next-dev'],
        serveStaticTargetName: [
          'serve-static',
          'next:serve-static',
          'next-serve-static',
        ],
      },
      schema.updatePackageScripts
    );
  }

  addGitIgnoreEntry(host);

  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = updateDependencies(host, schema);
  }

  return installTask;
}

export default nextInitGenerator;
