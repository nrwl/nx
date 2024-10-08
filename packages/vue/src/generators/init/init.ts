import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { nxVersion, vueVersion } from '../../utils/versions';
import { InitSchema } from './schema';

function updateDependencies(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(removeDependenciesFromPackageJson(host, ['@nx/vue'], []));
  tasks.push(
    addDependenciesToPackageJson(
      host,
      { vue: vueVersion },
      { '@nx/vue': nxVersion },
      undefined,
      schema.keepExistingVersions
    )
  );

  return runTasksInSerial(...tasks);
}

export async function vueInitGenerator(host: Tree, schema: InitSchema) {
  assertNotUsingTsSolutionSetup(host, 'vue', 'init');

  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = updateDependencies(host, schema);
  }

  if (!schema.skipFormat) {
    await formatFiles(host);
  }

  return installTask;
}

export default vueInitGenerator;
