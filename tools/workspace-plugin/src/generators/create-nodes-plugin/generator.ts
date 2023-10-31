import { formatFiles, generateFiles, names, Tree } from '@nx/devkit';
import { basename, join, relative } from 'path';
import migrationGenerator from '@nx/plugin/src/generators/migration/migration';

export async function generatorGenerator(tree: Tree) {
  const cwd = process.cwd();
  const { className, propertyName } = names(basename(cwd));

  await migrationGenerator(tree, {
    name: `add-${basename(cwd)}-plugin`,
    packageVersion: '17.2.0-beta.0',
    description: `Add @nx/${basename(cwd)}/plugin`,
    nameAndDirectoryFormat: 'as-provided',
    directory: `src/migrations/update-17-2-0`,
    skipFormat: true,
  });

  generateFiles(tree, join(__dirname, 'files'), relative(tree.root, cwd), {
    dirName: basename(cwd),
    className,
    propertyName,
  });

  await formatFiles(tree);
}

export default generatorGenerator;
