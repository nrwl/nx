import { applyChangesToString, ChangeType, Tree } from '@nx/devkit';
import { getDefaultExport } from './get-default-export';

export function insertStatementInDefaultFunction(
  tree: Tree,
  path: string,
  statement
) {
  const defaultExport = getDefaultExport(tree, path);

  if (!defaultExport) {
    throw Error('No default export found!');
  }

  const index =
    defaultExport.body.statements.length > 0
      ? defaultExport.body.statements[0].pos
      : 0;

  const newContents = applyChangesToString(tree.read(path, 'utf-8'), [
    {
      type: ChangeType.Insert,
      index,
      text: statement,
    },
  ]);

  tree.write(path, newContents);
}
