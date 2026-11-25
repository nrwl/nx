import type { Tree } from '@nx/devkit';
import { joinPathFragments, readJson } from '@nx/devkit';
import * as posix from 'node:path/posix';
import { dirname, parse } from 'path';

export interface LibraryBuilderEntryPoint {
  // "." for the primary entry point, otherwise "./<name>".
  subpath: string;
  entryFile: string;
}

// Reads the entry points that @angular/build:library builds from package.json
// exports, as its normalizeEntryPoints does. Entries it rejects are skipped.
export function readLibraryBuilderEntryPoints(
  tree: Tree,
  projectRoot: string
): LibraryBuilderEntryPoint[] {
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');
  if (!tree.exists(packageJsonPath)) {
    return [];
  }

  const { exports } = readJson(tree, packageJsonPath);
  if (
    !exports ||
    (typeof exports !== 'string' && typeof exports !== 'object')
  ) {
    return [];
  }
  const exportsRecord: Record<string, unknown> =
    typeof exports === 'string' ||
    Array.isArray(exports) ||
    !Object.keys(exports).some((key) => key.startsWith('.'))
      ? { '.': exports }
      : exports;

  const rootDir = joinPathFragments(projectRoot);
  const entryPoints: LibraryBuilderEntryPoint[] = [];
  for (const [key, value] of Object.entries(exportsRecord)) {
    const target = resolveExportTarget(value);
    // Targets follow the host's path rules, as in the builder. A target with a
    // root or drive is skipped, even one the builder resolves inside the project.
    if (!target || !/(?<!\.d)\.m?ts$/.test(target) || parse(target).root) {
      continue;
    }

    const normalizedKey = key.replace(/\/+$/, '');
    const isPrimary = normalizedKey === '.' || normalizedKey === '';
    const name = isPrimary
      ? '.'
      : normalizedKey.startsWith('./')
        ? normalizedKey.slice(2)
        : normalizedKey;
    if (
      !isPrimary &&
      (posix.isAbsolute(name) ||
        name.includes('..') ||
        posix.normalize(name) === '.')
    ) {
      continue;
    }

    const entryFile = joinPathFragments(rootDir, target);
    const relativeEntryFile = posix.relative(rootDir, entryFile);
    if (relativeEntryFile === '..' || relativeEntryFile.startsWith('../')) {
      continue;
    }

    entryPoints.push({
      subpath: isPrimary ? '.' : `./${name}`,
      entryFile,
    });
  }

  return entryPoints;
}

// The entry point whose entry file's directory is the closest one containing
// the directory. The primary wins a tie and is the fallback when none does.
export function locateLibraryBuilderEntryPoint(
  tree: Tree,
  directory: string,
  projectRoot: string
): string | null {
  let primaryEntryFile: string | undefined;
  let closest: { entryFile: string; distance: number } | undefined;
  for (const { subpath, entryFile } of readLibraryBuilderEntryPoints(
    tree,
    projectRoot
  )) {
    if (subpath === '.') {
      primaryEntryFile = entryFile;
    }

    const relativeDir = posix.relative(posix.dirname(entryFile), directory);
    if (relativeDir === '..' || relativeDir.startsWith('../')) {
      continue;
    }
    const distance = relativeDir === '' ? 0 : relativeDir.split('/').length;
    if (
      !closest ||
      distance < closest.distance ||
      (distance === closest.distance && subpath === '.')
    ) {
      closest = { entryFile, distance };
    }
  }

  const entryFile = closest?.entryFile ?? primaryEntryFile;
  return entryFile && tree.exists(entryFile) ? entryFile : null;
}

// An array resolves to its first resolvable item and a conditions object to
// its "default" condition, without checking the file extension.
function resolveExportTarget(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = resolveExportTarget(item);
      if (target) {
        return target;
      }
    }
    return undefined;
  }
  if (typeof value === 'object' && value !== null) {
    return resolveExportTarget((value as Record<string, unknown>).default);
  }
  return undefined;
}

export function locateLibraryEntryPointFromDirectory(
  tree: Tree,
  directory: string,
  projectRoot: string,
  projectSourceRoot: string
): string | null {
  const ngPackageJsonPath = joinPathFragments(directory, 'ng-package.json');
  let entryPointFile = tree.exists(ngPackageJsonPath)
    ? (readJson(tree, ngPackageJsonPath).lib?.entryFile ?? 'src/public_api.ts')
    : null;

  if (entryPointFile) {
    return joinPathFragments(directory, entryPointFile);
  }

  if (directory === projectRoot) {
    const indexFile = joinPathFragments(projectSourceRoot, 'index.ts');

    return tree.exists(indexFile) ? indexFile : null;
  }

  return locateLibraryEntryPointFromDirectory(
    tree,
    dirname(directory),
    projectRoot,
    projectSourceRoot
  );
}
