import { formatFiles, Tree } from '@nrwl/devkit';
import convertToNxProject from '@nrwl/workspace/src/generators/convert-to-nx-project/convert-to-nx-project';

export async function splitConfigurationIntoProjectJsonFiles(tree: Tree) {
  await convertToNxProject(tree, { all: true });
  await formatFiles(tree);
}

export default splitConfigurationIntoProjectJsonFiles;
