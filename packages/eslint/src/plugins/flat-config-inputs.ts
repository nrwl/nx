import { existsSync, realpathSync, statSync } from 'node:fs';
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

const RESOLVE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'];
const SCANNABLE_EXTENSIONS = new Set([...RESOLVE_EXTENSIONS, '.jsx', '.tsx']);

type BareImport =
  | { kind: 'external'; packageName: string }
  | { kind: 'fileset'; glob: string }
  | null;

/**
 * Walks the import graphs of flat configs, scanning each level of files in
 * one native call. Installed packages become external dependencies, relative
 * imports become file inputs (walked in turn), and packages linked into
 * `node_modules` from the workspace become filesets.
 */
export function collectFlatConfigInputs(
  configFiles: string[],
  workspaceRoot: string
): Map<string, FlatConfigInputs> {
  const realWorkspaceRoot = safeRealpath(workspaceRoot);
  const specifiersByFile = scanImportGraph(configFiles, workspaceRoot);
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

  const results = new Map<string, FlatConfigInputs>();
  for (const configFile of configFiles) {
    const entry = resolve(workspaceRoot, configFile);
    const externalDependencies = new Set<string>();
    const files = new Set<string>();
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
          files.add(workspaceRelative);
          visit(resolved);
          continue;
        }
        const bare = classify(specifier, dirname(file));
        if (bare?.kind === 'external') {
          externalDependencies.add(bare.packageName);
        } else if (bare?.kind === 'fileset') {
          files.add(bare.glob);
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
  workspaceRoot: string
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
    for (const file of pending) {
      const specifiers = scanned.get(file) ?? [];
      specifiersByFile.set(file, specifiers);
      for (const specifier of specifiers) {
        if (!isRelative(specifier)) continue;
        const resolved = resolveLocalFile(resolve(dirname(file), specifier));
        if (
          resolved &&
          isScannable(resolved) &&
          !specifiersByFile.has(resolved) &&
          toWorkspaceRelative(workspaceRoot, resolved)
        ) {
          next.add(resolved);
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
  const workspaceRelative = toWorkspaceRelative(
    realWorkspaceRoot,
    safeRealpath(packageDir)
  );
  if (workspaceRelative && !isInNodeModules(workspaceRelative)) {
    return { kind: 'fileset', glob: `${workspaceRelative}/**/*` };
  }
  return { kind: 'external', packageName };
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
