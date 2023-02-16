import {
  convertNxGenerator,
  ensurePackage,
  formatFiles,
  generateFiles,
  joinPathFragments,
  Tree,
} from '@nrwl/devkit';
import { getRootTsConfigFileName } from '../../utils/typescript/ts-config';
import { typescriptVersion } from '../../utils/versions';
import { InitSchema } from './schema';

export async function initGenerator(
  host: Tree,
  schema: InitSchema
): Promise<void> {
  if (!schema.js) {
    ensurePackage(host, 'typescript', typescriptVersion);
  }

  // add tsconfig.base.json
  if (!getRootTsConfigFileName()) {
    generateFiles(host, joinPathFragments(__dirname, './files'), '.', {});
  }

  if (!schema.skipFormat) {
    await formatFiles(host);
  }
}

export default initGenerator;

export const initSchematic = convertNxGenerator(initGenerator);
