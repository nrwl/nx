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
  // Needs a new `rootDir` pinned to `dirAbs` (the pre-6.0 inferred directory,
  // or the tsconfig's own directory for a composite config).
  | { kind: 'write'; dirAbs: string }
  // No output/containment option or no input files: TypeScript 6 runs neither
  // emit nor the source-containment check, so it needs no `rootDir`.
  | { kind: 'inert' }
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
 * whose files resolve outside that directory (most commonly a spec/e2e tsconfig
 * importing another project's source through a `paths` alias) then hard-fails
 * with TS5011 or TS6059.
 *
 * For every project `tsconfig*.json` that lacks an explicit `rootDir`, this pins
 * `rootDir` to exactly the directory TypeScript 5 would have inferred, so both
 * compilation and emit layout are unchanged under 6.0. The value is computed by
 * the compiler itself: a throwaway program built with `configFilePath` cleared
 * takes the file-derived branch of `getCommonSourceDirectory`, so it matches
 * `tsc` exactly, including project-reference redirects. The pin is written even
 * when the inferred directory already equals the tsconfig directory: inference
 * is per-program, and tools like ts-jest's `isolatedModules` compile single
 * files against the same config, collapsing the common directory below the
 * config dir and failing with TS5011.
 *
 * Composite configs are pinned too, to the tsconfig's own directory. Under `tsc`
 * a composite `rootDir` already defaults there (for any file subset), so `"."`
 * is a no-op — but ts-jest strips `composite` for its per-file transpile, and
 * TypeScript 6 only exempts genuinely-composite programs from the containment
 * check (`!options.composite`), so a composite spec config compiled by ts-jest
 * hits TS5011 all the same. The explicit `"."` survives the strip. Pinning the
 * own directory (not a deeper file-derived value) keeps a real composite build's
 * emit layout unchanged.
 *
 * Each config is written on its own; nothing is written to a shared `extends`
 * base, so a config never inherits a `rootDir` computed for a sibling — and
 * because every config that emits is given its own explicit `rootDir`, none
 * inherits a value pinned on a base. Runs only on TypeScript 6 workspaces
 * (gated by `requires`).
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

  // Phase 2: pin each config that needs a `rootDir` on its own. Every config
  // that emits is given its own explicit value here — including composites,
  // pinned to their own directory — so none is left to inherit a `rootDir` this
  // migration pins on a base.
  let changed = 0;
  for (const c of candidates) {
    if (c.analysis.kind === 'write') {
      const rootDir = toRelativeRootDir(c.dirAbs, c.analysis.dirAbs);
      if (setRootDir(tree, c.relPath, rootDir)) {
        changed++;
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
  // Composite: pin the tsconfig's own directory, not a file-derived value.
  // `rootDir` already defaults there under `tsc`, so `"."` preserves a real
  // composite build's emit layout — but ts-jest strips `composite` for its
  // per-file transpile, and TS6 only skips the containment check for genuinely
  // composite programs, so an unpinned composite spec config still fails with
  // TS5011 under ts-jest. The explicit pin survives the strip.
  if (options.composite) {
    return { kind: 'write', dirAbs: toPosix(dirname(absPath)) };
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
  // Written even when `commonDir` is the tsconfig's own directory (the 6.0
  // default): a tool compiling a subset of the config's files — ts-jest with
  // `isolatedModules` builds a program per test file — re-infers the common
  // directory from that subset alone, and without an explicit `rootDir` TS6
  // fails with TS5011.
  return { kind: 'write', dirAbs: toPosix(commonDir).replace(/\/+$/, '') };
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
        (root) => root === '' || normalized.startsWith(`${root}/`)
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

function toPosix(p: string): string {
  return p.split('\\').join('/');
}
