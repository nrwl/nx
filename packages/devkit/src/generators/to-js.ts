import type { Tree } from 'nx/src/devkit-exports';
import { transpileTypescript } from 'nx/src/devkit-internals';
import type { CompilerOptions } from 'typescript';
import { ensureTypescript } from '../utils/ensure-typescript';
import { ensurePackage } from '../utils/package-json';
import { typescriptVersion } from '../utils/versions';

// The same values in every TypeScript version Nx supports.
const JSX_EMIT_PRESERVE = 1;
const SCRIPT_TARGET_ESNEXT = 99;
const MODULE_KIND_ESNEXT = 99;

export type ToJSOptions = {
  extension?: '.js' | '.mjs' | '.cjs';
  /** A TypeScript `ModuleKind` value. */
  module?: number;
  /** A TypeScript `ScriptTarget` value. */
  target?: number;
  useJsx?: boolean;
};

/**
 * Rename and transpile any new typescript files created to javascript files
 */
export function toJS(tree: Tree, options?: ToJSOptions): void {
  const transpile = loadTranspile();

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
          jsx: JSX_EMIT_PRESERVE,
          target: options?.target ?? SCRIPT_TARGET_ESNEXT,
          module: options?.module ?? MODULE_KIND_ESNEXT,
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

function loadTranspile(): (
  input: string,
  compilerOptions: CompilerOptions
) => string {
  // @nx/devkit's nx peer range includes versions without transpileTypescript.
  // Those do not support TypeScript 7.1, so the TypeScript module transpiles.
  if (typeof transpileTypescript !== 'function') {
    return ensurePackage<typeof import('typescript')>(
      'typescript',
      typescriptVersion
    ).transpile;
  }
  ensureTypescript();
  return transpileTypescript;
}
