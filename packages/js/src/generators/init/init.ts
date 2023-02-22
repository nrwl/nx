import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  Tree,
} from '@nrwl/devkit';
import { getRootTsConfigFileName } from '../../utils/typescript/ts-config';
import { typescriptVersion, nxVersion } from '../../utils/versions';
import { InitSchema } from './schema';

export async function initGenerator(
  tree: Tree,
  schema: InitSchema
): Promise<GeneratorCallback> {
  // add tsconfig.base.json
  if (!getRootTsConfigFileName(tree)) {
    generateFiles(tree, joinPathFragments(__dirname, './files'), '.', {
      fileName: schema.tsConfigName ?? 'tsconfig.base.json',
    });
  }
  const devDependencies = {
    '@nrwl/js': nxVersion,
  };

  if (!schema.js) {
    devDependencies['typescript'] = typescriptVersion;
  }

  const installTask = !schema.skipPackageJson
    ? addDependenciesToPackageJson(tree, {}, devDependencies)
    : () => {};

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default initGenerator;

export const initSchematic = convertNxGenerator(initGenerator);
