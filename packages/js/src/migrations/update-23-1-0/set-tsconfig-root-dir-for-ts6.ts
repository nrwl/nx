import {
  formatFiles,
  getProjects,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import { basename, dirname, join, posix } from 'node:path';
import { applyEdits, modify } from 'jsonc-parser';
import type * as ts from 'typescript';
import { ensureTypescript } from '../../utils/typescript/ensure-typescript';

const FORMATTING_OPTIONS = {
  formattingOptions: { keepLines: true, insertSpaces: true, tabSize: 2 },
};

let tsModule: typeof import('typescript');

// What an absent `rootDir` means for a given tsconfig once TypeScript 6 lands.
type Analysis =
  // Needs a new `rootDir` pinned to `dirAbs` (the pre-6.0 inferred directory).
  | { kind: 'write'; dirAbs: string }
  // No output/containment option or no input files: TypeScript 6 runs neither
  // emit nor the source-containment check, so it needs no `rootDir`.
  | { kind: 'inert' }
  // Self-contained: its correct `rootDir` is its own directory. It has no
  // inherited `rootDir` today (or it would be `has-rootDir`), so it only needs a
  // write to shield it from a `rootDir` this migration pins on an `extends` base.
  | { kind: 'own-dir' }
  // Already sets `rootDir` (explicitly or via `extends`): unaffected.
  | { kind: 'has-rootDir' };

interface Candidate {
  relPath: string;
  dirAbs: string;
  analysis: Analysis;
}

/**
 * TypeScript 6.0 changed the implicit `rootDir`. Before 6.0 an unset `rootDir`
 * was inferred as the common directory of a program's non-declaration input
 * files; 6.0 defaults it to the tsconfig's own directory instead. A program
 * whose files resolve outside that directory - most commonly a spec/e2e tsconfig
 * importing another project's source through a `paths` alias - then hard-fails
 * with TS5011 or TS6059.
 *
 * For every project `tsconfig*.json` that lacks an explicit `rootDir`, this pins
 * `rootDir` to exactly the directory TypeScript 5 would have inferred, so both
 * compilation and emit layout are unchanged under 6.0. The value is computed by
 * the compiler itself: a throwaway program built with `configFilePath` cleared
 * takes the file-derived branch of `getCommonSourceDirectory`, so it matches
 * `tsc` exactly, including project-reference redirects. Configs already at the
 * 6.0 default are left untouched: their inferred directory equals the tsconfig
 * directory, or they are composite (which defaulted there before 6.0 too).
 *
 * Each config is written on its own; nothing is written to a shared `extends`
 * base, so a config never inherits a `rootDir` computed for a sibling. The one
 * case that needs care is a config that both needs a `rootDir` and is itself an
 * `extends` base: its own-directory children would inherit the new value and
 * shift their emit layout, so each such child is pinned to its own directory to
 * block it. Runs only on TypeScript 6 workspaces (gated by `requires`).
 */
export default async function (tree: Tree): Promise<void> {
  tsModule ??= ensureTypescript();
  const ts = tsModule;

  const parseConfigHost: ts.ParseConfigFileHost = {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: () => {},
  };

  const relPaths = collectProjectTsconfigs(tree);

  // Phase 1: analyze every candidate against the on-disk configs.
  const candidates: Candidate[] = relPaths.map((relPath) => {
    const absPath = toPosix(join(tree.root, relPath));
    return {
      relPath,
      dirAbs: toPosix(dirname(absPath)),
      analysis: analyze(ts, absPath, parseConfigHost),
    };
  });

  // Phase 2: pin each config that needs a `rootDir` on its own.
  let changed = 0;
  for (const c of candidates) {
    if (c.analysis.kind === 'write') {
      const rootDir = toRelativeRootDir(c.dirAbs, c.analysis.dirAbs);
      if (setRootDir(tree, c.relPath, rootDir)) {
        changed++;
      }
    }
  }

  // Phase 3: shield own-dir configs that now inherit a pinned `rootDir` from a
  // base. Re-parse each from the tree (so Phase 2's writes are visible); when
  // TypeScript reports an inherited `rootDir` where there was none, pin the
  // config to its own directory so its emit layout does not shift. Repeat until
  // stable, since shielding one config can turn it into a base for another. The
  // tree-backed host lets TypeScript resolve `extends`; the `readDirectory`
  // no-op skips the unused file scan.
  const readFile = (filePath: string) =>
    tree.read(filePath, 'utf-8') ?? undefined;
  const treeParseHost: ts.ParseConfigHost = {
    ...ts.sys,
    readFile,
    readDirectory: () => [],
  };
  const shielded = new Set<string>();
  let added = true;
  while (added) {
    added = false;
    for (const c of candidates) {
      if (c.analysis.kind !== 'own-dir' || shielded.has(c.relPath)) {
        continue;
      }
      if (inheritsRootDir(ts, treeParseHost, readFile, c.relPath)) {
        if (setRootDir(tree, c.relPath, '.')) {
          changed++;
        }
        shielded.add(c.relPath);
        added = true;
      }
    }
  }

  if (changed > 0) {
    await formatFiles(tree);
  }
}

function analyze(
  ts: typeof import('typescript'),
  absPath: string,
  parseConfigHost: ts.ParseConfigFileHost
): Analysis {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    absPath,
    undefined,
    parseConfigHost
  );
  if (!parsed) {
    return { kind: 'inert' };
  }
  const { options, fileNames, projectReferences } = parsed;

  if (options.rootDir != null) {
    return { kind: 'has-rootDir' };
  }
  if (!setsEmitGate(options) || fileNames.length === 0) {
    return { kind: 'inert' };
  }
  // Composite already defaults `rootDir` to the tsconfig's own directory in both
  // 5.x and 6.0, so the 6.0 change leaves it alone. Treat it as own-dir: never
  // pin a file-derived value, and shield it from a `rootDir` this migration pins
  // on an `extends` base.
  if (options.composite) {
    return { kind: 'own-dir' };
  }

  const commonDir = computeCommonSourceDirectory(
    ts,
    fileNames,
    options,
    projectReferences
  );
  if (!commonDir) {
    return { kind: 'inert' };
  }
  if (equalPaths(ts, commonDir, dirname(absPath))) {
    return { kind: 'own-dir' };
  }
  return { kind: 'write', dirAbs: toPosix(commonDir).replace(/\/+$/, '') };
}

// True when TypeScript resolves an inherited `rootDir` for the config. An own-dir
// config sets none of its own, so any `rootDir` reported here comes from a base
// this migration just pinned, and inheriting it would shift the config's emit
// layout.
function inheritsRootDir(
  ts: typeof import('typescript'),
  parseHost: ts.ParseConfigHost,
  readFile: (filePath: string) => string | undefined,
  relPath: string
): boolean {
  const config = ts.readConfigFile(relPath, readFile).config;
  if (!config) {
    return false;
  }
  const { options } = ts.parseJsonConfigFileContent(
    config,
    parseHost,
    dirname(relPath)
  );
  return options.rootDir != null;
}

// Any of these makes TypeScript run the source-file containment / common-source
// computation that emits TS5011 / TS6059 when `rootDir` is absent.
function setsEmitGate(o: ts.CompilerOptions): boolean {
  return !!(
    o.outDir ||
    o.outFile ||
    o.sourceRoot ||
    o.mapRoot ||
    (o.declaration && o.declarationDir)
  );
}

function computeCommonSourceDirectory(
  ts: typeof import('typescript'),
  rootNames: readonly string[],
  parsedOptions: ts.CompilerOptions,
  projectReferences: readonly ts.ProjectReference[] | undefined
): string | undefined {
  // Clearing `configFilePath` makes `getCommonSourceDirectory` take the
  // file-derived branch (the pre-6.0 inference) instead of returning the
  // tsconfig's own directory. `noLib` skips lib.d.ts (declarations, irrelevant
  // to the calc). `projectReferences` preserves reference-redirect semantics, so
  // a source file provided by a referenced project is excluded via its `.d.ts`.
  const options: ts.CompilerOptions = {
    ...parsedOptions,
    noLib: true,
    configFilePath: undefined,
  };
  // A fresh host per program so each config resolves on its own, with no parse or
  // module-resolution state shared across configs. Letting the program resolve
  // modules itself (no custom `resolveModuleNameLiterals`) keeps resolution
  // mode-aware under node16/nodenext/bundler, matching tsc.
  const host = ts.createCompilerHost(options, /* setParentNodes */ false);
  const program = ts.createProgram({
    rootNames,
    options,
    host,
    projectReferences,
  });
  // `getCommonSourceDirectory` is a real Program method but is absent from the
  // public `Program` type, so widen it here.
  const commonSourceDirectory = (
    program as ts.Program & { getCommonSourceDirectory(): string }
  ).getCommonSourceDirectory();
  return commonSourceDirectory || undefined;
}

function collectProjectTsconfigs(tree: Tree): string[] {
  const projectRoots = [...getProjects(tree).values()].map((p) =>
    p.root === '.' ? '' : p.root
  );
  const tsconfigs: string[] = [];
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    const name = basename(filePath);
    if (!name.startsWith('tsconfig') || !name.endsWith('.json')) {
      return;
    }
    const normalized = toPosix(filePath);
    // Only touch tsconfigs owned by a project; never a workspace-root base
    // whose (unknown) extenders we would silently affect.
    if (
      projectRoots.some(
        (root) =>
          root === '' ||
          normalized === root ||
          normalized.startsWith(`${root}/`)
      )
    ) {
      tsconfigs.push(filePath);
    }
  });
  return tsconfigs;
}

function setRootDir(
  tree: Tree,
  tsconfigPath: string,
  rootDir: string
): boolean {
  const contents = tree.read(tsconfigPath, 'utf-8');
  if (!contents) {
    return false;
  }
  const edits = modify(
    contents,
    ['compilerOptions', 'rootDir'],
    rootDir,
    FORMATTING_OPTIONS
  );
  if (edits.length === 0) {
    return false;
  }
  tree.write(tsconfigPath, applyEdits(contents, edits));
  return true;
}

function toRelativeRootDir(tsconfigDir: string, commonDir: string): string {
  const rel = posix.relative(toPosix(tsconfigDir), toPosix(commonDir));
  return rel === '' ? '.' : rel;
}

function equalPaths(
  ts: typeof import('typescript'),
  a: string,
  b: string
): boolean {
  const normalize = (p: string) => {
    const stripped = toPosix(p).replace(/\/+$/, '');
    return ts.sys.useCaseSensitiveFileNames ? stripped : stripped.toLowerCase();
  };
  return normalize(a) === normalize(b);
}

function toPosix(p: string): string {
  return p.split('\\').join('/');
}
