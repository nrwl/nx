import { addPlugin } from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { InitSchema } from './schema';
import { getReactDependenciesVersionsToInstall } from '../../utils/version-utils';
import { assertSupportedReactVersion } from '../../utils/assert-supported-react-version';
import { createNodes } from '../../plugins/router-plugin';

export async function reactInitGenerator(tree: Tree, schema: InitSchema) {
  assertSupportedReactVersion(tree);

  const tasks: GeneratorCallback[] = [];

  if (!schema.skipPackageJson) {
    tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/react'], []));
    const reactDeps = await getReactDependenciesVersionsToInstall(tree);
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {
          react: reactDeps.react,
          'react-dom': reactDeps['react-dom'],
        },
        {
          '@nx/react': nxVersion,
        },
        undefined,
        schema.keepExistingVersions ?? true
      )
    );
  }

  const nxJson = readNxJson(tree);
  schema.addPlugin ??=
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  if (schema.useReactRouterPlugin && schema.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/react/router-plugin',
      createNodes,
      {
        buildTargetName: ['build', 'react-router:build', 'react-router-build'],
        devTargetName: ['dev', 'react-router:dev', 'react-router-dev'],
        startTargetName: ['start', 'react-router-serve', 'react-router-start'],
        watchDepsTargetName: [
          'watch-deps',
          'react-router:watch-deps',
          'react-router-watch-deps',
        ],
        buildDepsTargetName: [
          'build-deps',
          'react-router:build-deps',
          'react-router-build-deps',
        ],
      },
      schema.updatePackageScripts
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default reactInitGenerator;
