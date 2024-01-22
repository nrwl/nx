import type { Tree } from 'nx/src/generators/tree';
import type { ScriptTarget, ModuleKind } from 'typescript';
import { typescriptVersion } from '../utils/versions';
import { ensurePackage } from '../utils/package-json';

export type ToJSOptions = {
  target?: ScriptTarget;
  module?: ModuleKind;
  extension: '.js' | '.mjs' | '.cjs';
};

/**
 * Rename and transpile any new typescript files created to javascript files
 */
export function toJS(tree: Tree, options?: ToJSOptions): void {
  const { JsxEmit, ScriptTarget, transpile, ModuleKind } = ensurePackage(
    'typescript',
    typescriptVersion
  ) as typeof import('typescript');

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
          target: options?.target ?? ScriptTarget.ESNext,
          module: options?.module ?? ModuleKind.ESNext,
        })
      );
      tree.rename(
        c.path,
        c.path.replace(/\.tsx?$/, options?.extension ?? '.js')
      );
    }
  }
}
