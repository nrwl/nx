import {
  convertNxGenerator,
  getWorkspaceLayout,
  joinPathFragments,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { join } from 'path';
import { projectGenerator } from '../../utils/project-generator';
import { Schema } from '../../utils/schema';

export async function libraryGenerator(tree: Tree, schema: Schema) {
  const { libsDir } = getWorkspaceLayout(tree);
  return projectGenerator(
    tree,
    schema,
    libsDir,
    join(__dirname, './files'),
    'library'
  );
}

export default libraryGenerator;
export const librarySchematic = convertNxGenerator(libraryGenerator);
