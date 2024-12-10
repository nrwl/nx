import {
  addDependenciesToPackageJson,
  formatFiles,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { InitSchema } from './schema';
import { getReactDependenciesVersionsToInstall } from '../../utils/version-utils';

export async function reactInitGenerator(tree: Tree, schema: InitSchema) {
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
        schema.keepExistingVersions
      )
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default reactInitGenerator;
