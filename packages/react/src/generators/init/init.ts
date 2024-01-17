import {
  addDependenciesToPackageJson,
  formatFiles,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { nxVersion, reactDomVersion, reactVersion } from '../../utils/versions';
import { InitSchema } from './schema';

export async function reactInitGenerator(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  if (!schema.skipPackageJson) {
    tasks.push(removeDependenciesFromPackageJson(host, ['@nx/react'], []));

    tasks.push(
      addDependenciesToPackageJson(
        host,
        {
          react: reactVersion,
          'react-dom': reactDomVersion,
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
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default reactInitGenerator;
