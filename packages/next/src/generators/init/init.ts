import {
  addDependenciesToPackageJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  type GeneratorCallback,
  type Tree,
  readNxJson,
  createProjectGraphAsync,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import {
  getReactDependenciesVersionsToInstall,
  isReact18,
} from '@nx/react/src/utils/version-utils';
import { addGitIgnoreEntry } from '../../utils/add-gitignore-entry';
import { nxVersion } from '../../utils/versions';
import { getNextDependenciesVersionsToInstall } from '../../utils/version-utils';
import type { InitSchema } from './schema';

async function updateDependencies(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(removeDependenciesFromPackageJson(host, ['@nx/next'], []));

  const versions = await getNextDependenciesVersionsToInstall(
    host,
    await isReact18(host)
  );
  const reactVersions = await getReactDependenciesVersionsToInstall(host);

  tasks.push(
    addDependenciesToPackageJson(
      host,
      {
        next: versions.next,
        react: reactVersions.react,
        'react-dom': reactVersions['react-dom'],
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
    const { createNodesV2 } = await import('../../plugins/plugin');
    await addPlugin(
      host,
      await createProjectGraphAsync(),
      '@nx/next/plugin',
      createNodesV2,
      {
        startTargetName: ['start', 'next:start', 'next-start'],
        buildTargetName: ['build', 'next:build', 'next-build'],
        devTargetName: ['dev', 'next:dev', 'next-dev'],
        serveStaticTargetName: [
          'serve-static',
          'next:serve-static',
          'next-serve-static',
        ],
        buildDepsTargetName: [
          'build-deps',
          'next:build-deps',
          'next-build-deps',
        ],
        watchDepsTargetName: [
          'watch-deps',
          'next:watch-deps',
          'next-watch-deps',
        ],
      },
      schema.updatePackageScripts
    );
  }

  addGitIgnoreEntry(host);

  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = await updateDependencies(host, schema);
  }

  return installTask;
}

export default nextInitGenerator;
