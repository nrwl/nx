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
  // No output/containment option or no input files: an inherited `rootDir` is
  // harmless, so this config never blocks a collapse.
  | { kind: 'inert' }
  // Self-contained: its correct `rootDir` is its own directory, so it must not
  // inherit a higher one from a base (that would change its emit layout).
  | { kind: 'own-dir' }
  // Already sets `rootDir` (explicitly or via `extends`): unaffected.
  | { kind: 'has-rootDir' };

interface Candidate {
  relPath: string;
  absPath: string;
  dirAbs: string;
  extendsAbs: string | null;
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
 * `tsc` exactly, including project-reference redirects. Configs whose inferred
 * directory already equals the tsconfig directory (the 6.0 default) are left
 * untouched.
 *
 * To keep the diff minimal, when several configs that extend the same
 * project-local base all need the identical new `rootDir`, it is written once to
 * that base and inherited, but only when every config extending the base agrees
 * (or is unaffected). Runs only on TypeScript 6 workspaces (gated by `requires`).
 */
export default async function (tree: Tree): Promise<void> {
  tsModule ??= ensureTypescript();
  const ts = tsModule;

  const parseConfigHost: ts.ParseConfigFileHost = {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: () => {},
  };
  // One host + module-resolution cache shared across every candidate program, so
  // sources pulled in by multiple tsconfigs (shared libs, referenced projects)
  // parse once instead of once per config.
  const host = createSharedHost(ts);

  const relPaths = collectProjectTsconfigs(tree);
  const enumeratedAbs = new Set(
    relPaths.map((relPath) => toPosix(join(tree.root, relPath)))
  );

  // Phase 1: analyze every candidate.
  const candidates: Candidate[] = [];
  for (const relPath of relPaths) {
    const absPath = toPosix(join(tree.root, relPath));
    candidates.push({
      relPath,
      absPath,
      dirAbs: toPosix(dirname(absPath)),
      extendsAbs: resolveExtends(ts, absPath, enumeratedAbs),
      analysis: analyze(ts, absPath, parseConfigHost, host),
    });
  }

  // Phase 2: decide writes, collapsing agreeing siblings onto their shared base.
  const writes = planWrites(ts, candidates);

  // Phase 3: apply.
  const byAbs = new Map(candidates.map((c) => [c.absPath, c]));
  let changed = 0;
  for (const [absPath, dirAbs] of writes) {
    const candidate = byAbs.get(absPath);
    if (!candidate) {
      continue;
    }
    const rootDir = toRelativeRootDir(candidate.dirAbs, dirAbs);
    if (setRootDir(tree, candidate.relPath, rootDir)) {
      changed++;
    }
  }

  if (changed > 0) {
    await formatFiles(tree);
  }
}

function analyze(
  ts: typeof import('typescript'),
  absPath: string,
  parseConfigHost: ts.ParseConfigFileHost,
  host: ts.CompilerHost
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

  const commonDir = computeCommonSourceDirectory(
    ts,
    fileNames,
    options,
    projectReferences,
    host
  );
  if (!commonDir) {
    return { kind: 'inert' };
  }
  if (equalPaths(ts, commonDir, dirname(absPath))) {
    return { kind: 'own-dir' };
  }
  return { kind: 'write', dirAbs: toPosix(commonDir).replace(/\/+$/, '') };
}

// Returns a map of tsconfig-abs-path -> rootDir-target-abs-dir to write.
function planWrites(
  ts: typeof import('typescript'),
  candidates: Candidate[]
): Map<string, string> {
  const writes = new Map<string, string>();
  for (const c of candidates) {
    if (c.analysis.kind === 'write') {
      writes.set(c.absPath, c.analysis.dirAbs);
    }
  }

  const byAbs = new Map(candidates.map((c) => [c.absPath, c]));
  const childrenOf = new Map<string, Candidate[]>();
  for (const c of candidates) {
    if (!c.extendsAbs) {
      continue;
    }
    const siblings = childrenOf.get(c.extendsAbs) ?? [];
    siblings.push(c);
    childrenOf.set(c.extendsAbs, siblings);
  }

  for (const [baseAbs, children] of childrenOf) {
    const base = byAbs.get(baseAbs);
    if (!base) {
      continue;
    }
    const writers = children.filter((c) => c.analysis.kind === 'write');
    // Only worth collapsing when it removes at least one write.
    if (writers.length < 2) {
      continue;
    }
    const targets = new Set(
      writers.map((c) => (c.analysis as { dirAbs: string }).dirAbs)
    );
    if (targets.size !== 1) {
      continue;
    }
    const target = [...targets][0];

    // Safe only if every config extending the base either needs the same target,
    // is unaffected by inheriting it, or sets its own rootDir - and no child is
    // itself a base (keep inheritance depth to one, so the check stays complete).
    const safe = children.every((c) => {
      if (childrenOf.has(c.absPath)) {
        return false;
      }
      switch (c.analysis.kind) {
        case 'write':
          return c.analysis.dirAbs === target;
        case 'inert':
        case 'has-rootDir':
          return true;
        case 'own-dir':
          return false;
      }
    });
    // The base itself must want the same target or be unaffected by hosting it.
    const baseOk =
      base.analysis.kind === 'inert' ||
      (base.analysis.kind === 'write' && base.analysis.dirAbs === target);
    if (!safe || !baseOk) {
      continue;
    }

    writes.set(baseAbs, target);
    for (const w of writers) {
      writes.delete(w.absPath);
    }
  }

  return writes;
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
  projectReferences: readonly ts.ProjectReference[] | undefined,
  host: ts.CompilerHost
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

function createSharedHost(ts: typeof import('typescript')): ts.CompilerHost {
  const host = ts.createCompilerHost({}, /* setParentNodes */ false);

  const sourceFileCache = new Map<string, ts.SourceFile | undefined>();
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = ((fileName: string, ...rest: unknown[]) => {
    const key = host.getCanonicalFileName(fileName);
    if (sourceFileCache.has(key)) {
      return sourceFileCache.get(key);
    }
    const sourceFile = (getSourceFile as (...a: unknown[]) => ts.SourceFile)(
      fileName,
      ...rest
    );
    sourceFileCache.set(key, sourceFile);
    return sourceFile;
  }) as ts.CompilerHost['getSourceFile'];

  const moduleResolutionCache = ts.createModuleResolutionCache(
    ts.sys.getCurrentDirectory(),
    host.getCanonicalFileName
  );
  host.resolveModuleNameLiterals = (
    moduleLiterals,
    containingFile,
    redirectedReference,
    options
  ) =>
    moduleLiterals.map((literal) =>
      ts.resolveModuleName(
        literal.text,
        containingFile,
        options,
        host,
        moduleResolutionCache,
        redirectedReference
      )
    );

  return host;
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

// Resolves a tsconfig's single relative `extends` to an enumerated project
// config, or null (array extends, package specifiers, and out-of-project bases
// are not collapse targets).
function resolveExtends(
  ts: typeof import('typescript'),
  absPath: string,
  enumeratedAbs: Set<string>
): string | null {
  const ext = ts.readConfigFile(absPath, ts.sys.readFile).config?.extends;
  if (typeof ext !== 'string' || !ext.startsWith('.')) {
    return null;
  }
  const resolved = toPosix(join(dirname(absPath), ext));
  for (const candidate of [
    resolved,
    `${resolved}.json`,
    posix.join(resolved, 'tsconfig.json'),
  ]) {
    if (enumeratedAbs.has(candidate)) {
      return candidate;
    }
  }
  return null;
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
