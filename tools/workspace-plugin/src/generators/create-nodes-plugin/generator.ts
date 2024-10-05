import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  Tree,
  updateJson,
} from '@nx/devkit';
import { basename, join, relative } from 'path';
import migrationGenerator from '@nx/plugin/src/generators/migration/migration';

export async function generatorGenerator(tree: Tree) {
  const cwd = process.cwd();
  const { className, propertyName } = names(basename(cwd));

  await migrationGenerator(tree, {
    name: `add-${basename(cwd)}-plugin`,
    packageVersion: '17.2.0-beta.0',
    description: `Add @nx/${basename(cwd)}/plugin`,
    path: `src/migrations/update-17-2-0`,
    skipFormat: true,
  });

  generateFiles(tree, join(__dirname, 'files'), relative(tree.root, cwd), {
    dirName: basename(cwd),
    className,
    propertyName,
  });

  updateJson(
    tree,
    joinPathFragments(relative(tree.root, cwd), 'package.json'),
    (json) => {
      if (json['exports']) {
        json['exports']['./plugin'] = './plugin.js';
      }
      return json;
    }
  );

  await formatFiles(tree);
}

export default generatorGenerator;
