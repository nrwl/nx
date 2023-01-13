import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  Tree,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { typescriptVersion } from '../../utils/versions';
import { InitSchema } from './schema';

function addDependencies(host: Tree) {
  return addDependenciesToPackageJson(
    host,
    {},
    {
      typescript: typescriptVersion,
    }
  );
}

export function jsInitGenerator(
  host: Tree,
  schema: InitSchema
): GeneratorCallback {
  const tasks: GeneratorCallback[] = [];

  if (!schema.skipPackageJson) {
    const installTask = addDependencies(host);
    tasks.push(installTask);
  }

  // add tsconfig.base.json
  if (!schema.skipTsConfig && !host.exists('tsconfig.base.json')) {
    generateFiles(host, joinPathFragments(__dirname, './files'), '.', {});
  }

  return runTasksInSerial(...tasks);
}

export default jsInitGenerator;

export const jsInitSchematic = convertNxGenerator(jsInitGenerator);
