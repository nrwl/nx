import { generateFiles, names, Tree } from '@nx/devkit';
import { basename, join, relative } from 'path';

export interface GeneratorGeneratorSchema {}

export async function generatorGenerator(
  tree: Tree,
  options: GeneratorGeneratorSchema
) {
  const cwd = process.cwd();
  const { className, propertyName } = names(basename(cwd));

  generateFiles(tree, join(__dirname, 'files'), relative(tree.root, cwd), {
    dirName: basename(cwd),
    className,
    propertyName,
  });
}

export default generatorGenerator;
