import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { findImports } from '@nx/devkit/internal';

export interface FlatConfigInputs {
  externalDependencies: string[];
  files: string[];
}

const SCANNABLE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.mts',
  '.cts',
  '.tsx',
]);
const RESOLVE_EXTENSIONS = [
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.json',
];

type BareImport =
  | { kind: 'external'; packageName: string }
  | { kind: 'linked'; dir: string; glob: string; entry: string | null }
  | null;

/**
 * Walks flat config import graphs one native scan per level. Installed packages
 * become external dependencies, relative imports become file inputs, and linked
 * workspace packages become filesets; relative files and linked entries are walked.
 */
export function collectFlatConfigInputs(
  configFiles: string[],
  workspaceRoot: string
): Map<string, FlatConfigInputs> {
  const realWorkspaceRoot = safeRealpath(workspaceRoot);
  const bareImportCache = new Map<string, BareImport>();
  const classify = (specifier: string, fromDir: string): BareImport => {
    const key = `${fromDir}\0${specifier}`;
    if (!bareImportCache.has(key)) {
      bareImportCache.set(
        key,
        classifyBareImport(specifier, fromDir, workspaceRoot, realWorkspaceRoot)
      );
    }
    return bareImportCache.get(key);
  };
  const specifiersByFile = scanImportGraph(
    configFiles,
    workspaceRoot,
    classify
  );

  const results = new Map<string, FlatConfigInputs>();
  for (const configFile of configFiles) {
    const entry = resolve(workspaceRoot, configFile);
    const externalDependencies = new Set<string>();
    const files = new Set<string>();
    const linkedDirs: string[] = [];
    const visited = new Set<string>();

    const visit = (file: string): void => {
      if (visited.has(file)) return;
      visited.add(file);
      for (const specifier of specifiersByFile.get(file) ?? []) {
        if (isRelative(specifier)) {
          const resolved = resolveLocalFile(resolve(dirname(file), specifier));
          const workspaceRelative =
            resolved && toWorkspaceRelative(workspaceRoot, resolved);
          if (!workspaceRelative) continue;
          if (!linkedDirs.some((dir) => workspaceRelative.startsWith(dir))) {
            files.add(workspaceRelative);
          }
          visit(resolved);
          continue;
        }
        const bare = classify(specifier, dirname(file));
        if (bare?.kind === 'external') {
          externalDependencies.add(bare.packageName);
        } else if (bare?.kind === 'linked') {
          files.add(bare.glob);
          linkedDirs.push(`${bare.dir}/`);
          if (bare.entry) visit(bare.entry);
        }
      }
    };

    visit(entry);
    files.delete(toWorkspaceRelative(workspaceRoot, entry));
    results.set(configFile, {
      externalDependencies: Array.from(externalDependencies),
      files: Array.from(files),
    });
  }
  return results;
}

function scanImportGraph(
  configFiles: string[],
  workspaceRoot: string,
  classify: (specifier: string, fromDir: string) => BareImport
): Map<string, string[]> {
  const specifiersByFile = new Map<string, string[]>();
  let pending = Array.from(
    new Set(configFiles.map((f) => resolve(workspaceRoot, f)))
  ).filter(isScannable);

  while (pending.length > 0) {
    const scanned = new Map<string, string[]>();
    for (const result of findImports({ eslint: pending })) {
      scanned.set(result.file, [
        ...result.staticImportExpressions,
        ...result.dynamicImportExpressions,
      ]);
    }
    const next = new Set<string>();
    const enqueue = (file: string | null) => {
      if (
        file &&
        isScannable(file) &&
        !specifiersByFile.has(file) &&
        toWorkspaceRelative(workspaceRoot, file)
      ) {
        next.add(file);
      }
    };
    for (const file of pending) {
      const specifiers = scanned.get(file) ?? [];
      specifiersByFile.set(file, specifiers);
      for (const specifier of specifiers) {
        if (isRelative(specifier)) {
          enqueue(resolveLocalFile(resolve(dirname(file), specifier)));
        } else {
          const bare = classify(specifier, dirname(file));
          if (bare?.kind === 'linked') enqueue(bare.entry);
        }
      }
    }
    pending = Array.from(next).filter((f) => !specifiersByFile.has(f));
  }
  return specifiersByFile;
}

function classifyBareImport(
  specifier: string,
  fromDir: string,
  workspaceRoot: string,
  realWorkspaceRoot: string
): BareImport {
  const packageName = getPackageName(specifier);
  if (!packageName) return null;
  const packageDir = findPackageDir(packageName, fromDir, workspaceRoot);
  if (!packageDir) return null;
  const realPackageDir = safeRealpath(packageDir);
  const workspaceRelative = toWorkspaceRelative(
    realWorkspaceRoot,
    realPackageDir
  );
  if (workspaceRelative && !isInNodeModules(workspaceRelative)) {
    const dir = resolve(workspaceRoot, workspaceRelative);
    return {
      kind: 'linked',
      dir: workspaceRelative,
      glob: `${escapeGlob(workspaceRelative)}/**/*`,
      entry: resolvePackageEntry(dir),
    };
  }
  return { kind: 'external', packageName };
}

function resolvePackageEntry(packageDir: string): string | null {
  let manifest: { main?: unknown; exports?: unknown };
  try {
    manifest = JSON.parse(
      readFileSync(join(packageDir, 'package.json'), 'utf-8')
    );
  } catch {
    return null;
  }
  const entry =
    pickExportTarget(manifest.exports) ??
    (typeof manifest.main === 'string' ? manifest.main : 'index');
  return resolveLocalFile(resolve(packageDir, entry));
}

function pickExportTarget(exports: unknown): string | null {
  if (typeof exports === 'string') return exports;
  if (!exports || typeof exports !== 'object') return null;
  const record = exports as Record<string, unknown>;
  if ('.' in record) return pickExportTarget(record['.']);
  for (const condition of ['require', 'node', 'default', 'import']) {
    if (condition in record) return pickExportTarget(record[condition]);
  }
  return null;
}

function escapeGlob(path: string): string {
  return path.replace(/[[\]*?{}()]/g, (char) => `[${char}]`);
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith('.') || isAbsolute(specifier);
}

function isScannable(file: string): boolean {
  return SCANNABLE_EXTENSIONS.has(extname(file));
}

function resolveLocalFile(basePath: string): string | null {
  const candidates = [
    basePath,
    ...RESOLVE_EXTENSIONS.map((ext) => `${basePath}${ext}`),
    ...RESOLVE_EXTENSIONS.map((ext) => join(basePath, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

function getPackageName(specifier: string): string | null {
  if (specifier.startsWith('node:') || specifier.startsWith('#')) return null;
  const segments = specifier.split('/');
  const packageName = specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0];
  if (!packageName || builtinModules.includes(packageName)) return null;
  return packageName;
}

function findPackageDir(
  packageName: string,
  fromDir: string,
  workspaceRoot: string
): string | null {
  let current = fromDir;
  while (true) {
    const candidate = join(current, 'node_modules', packageName);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (current === workspaceRoot || current === dirname(current)) return null;
    current = dirname(current);
  }
}

function toWorkspaceRelative(
  root: string,
  absolutePath: string
): string | null {
  const workspaceRelative = relative(root, absolutePath).split(sep).join('/');
  if (workspaceRelative.startsWith('..') || isAbsolute(workspaceRelative)) {
    return null;
  }
  return workspaceRelative;
}

function isInNodeModules(workspaceRelative: string): boolean {
  return workspaceRelative.split('/').includes('node_modules');
}

function safeRealpath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
