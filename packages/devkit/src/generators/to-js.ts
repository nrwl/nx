import type { Tree } from 'nx/src/devkit-exports';
import type { ModuleKind, ScriptTarget } from 'typescript';
import { typescriptVersion } from '../utils/versions';
import { ensurePackage } from '../utils/package-json';

export type ToJSOptions = {
  extension?: '.js' | '.mjs' | '.cjs';
  module?: ModuleKind;
  target?: ScriptTarget;
  useJsx?: boolean;
};

/**
 * Rename and transpile any new typescript files created to javascript files
 */
export function toJS(tree: Tree, options?: ToJSOptions): void {
  const { JsxEmit, ScriptTarget, transpile, ModuleKind } = ensurePackage(
    'typescript',
    typescriptVersion
  ) as typeof import('typescript');

  // Match `.ts`, `.mts`, `.cts`, `.tsx`. The optional `[cm]` keeps native
  // ESM (`.mts`) and CommonJS (`.cts`) TypeScript extensions in the rename
  // path so `--js` generators that emit `.mts`/`.cts` templates get
  // converted instead of silently left as TypeScript on disk.
  const tsExtRegex = /\.([cm]?ts|tsx)$/;
  for (const c of tree.listChanges()) {
    if (tsExtRegex.test(c.path) && c.type === 'CREATE') {
      tree.write(
        c.path,
        transpile(c.content.toString('utf-8'), {
          allowJs: true,
          jsx: JsxEmit.Preserve,
          target: options?.target ?? ScriptTarget.ESNext,
          module: options?.module ?? ModuleKind.ESNext,
        })
      );
      const targetExt = options?.extension ?? '.js';
      tree.rename(c.path, c.path.replace(/\.([cm]?ts)$/, targetExt));
      if (options?.useJsx) {
        tree.rename(c.path, c.path.replace(/\.tsx$/, '.jsx'));
      } else {
        tree.rename(c.path, c.path.replace(/\.tsx$/, targetExt));
      }
    }
  }
}
