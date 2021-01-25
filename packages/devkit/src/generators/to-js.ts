import { JsxEmit, ScriptTarget, transpile } from 'typescript';
import { Tree } from '@nrwl/tao/src/shared/tree';

/**
 * Rename and transpile any new typescript files created to javascript files
 */
export function toJS(tree: Tree) {
  for (const c of tree.listChanges()) {
    if (
      (c.path.endsWith('.ts') || c.path.endsWith('tsx')) &&
      c.type === 'CREATE'
    ) {
      tree.write(
        c.path,
        transpile(c.content.toString('utf-8'), {
          allowJs: true,
          jsx: JsxEmit.Preserve,
          target: ScriptTarget.ESNext,
        })
      );
      tree.rename(c.path, c.path.replace(/\.tsx?$/, '.js'));
    }
  }
}
