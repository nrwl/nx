import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  Tree,
  workspaceRoot,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { typescriptVersion } from '../../utils/versions';
import { InitSchema } from './schema';

function updateDependencies(host: Tree) {
  return addDependenciesToPackageJson(
    host,
    {},
    {
      typescript: typescriptVersion,
    }
  );
}

export async function jsInitGenerator(
  host: Tree,
  schema: InitSchema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];

  if (!schema.skipPackageJson) {
    const installTask = updateDependencies(host);
    tasks.push(installTask);
  }

  // add tsconfig.base.json
  generateFiles(
    host,
    joinPathFragments(__dirname, '../files'),
    workspaceRoot,
    {}
  );

  return runTasksInSerial(...tasks);
}

export default jsInitGenerator;

export const jsInitSchematic = convertNxGenerator(jsInitGenerator);
