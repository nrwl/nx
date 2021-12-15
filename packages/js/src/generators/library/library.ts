import { convertNxGenerator, getWorkspaceLayout, Tree } from '@nrwl/devkit';
import { join } from 'path';
import { projectGenerator } from '../../utils/project-generator';
import { GeneratorSchema } from '../../utils/schema';

export async function libraryGenerator(tree: Tree, schema: GeneratorSchema) {
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
