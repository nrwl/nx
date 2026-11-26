import {
  joinPathFragments,
  normalizePath,
  readJsonFile,
  workspaceRoot,
  readCachedProjectGraph,
} from '@nx/devkit';
import { dirname, join, relative, resolve } from 'path';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'fs';
import ignore from 'ignore';
import {
  createProjectRootMappings,
  findAllProjectNodeDependencies,
  findProjectForPath,
  getProjectSourceRoot,
} from '@nx/devkit/internal';
import {
  isEntryPointDirectoryExport,
  resolveExportTarget,
} from './package-json/export-entry-points';

function configureIgnore() {
  let ig: ReturnType<typeof ignore>;
  const pathToGitIgnore = join(workspaceRoot, '.gitignore');
  if (existsSync(pathToGitIgnore)) {
    ig = ignore();
    ig.add(readFileSync(pathToGitIgnore, { encoding: 'utf-8' }));
  }
  return ig;
}

/**
 * Generates a set of glob patterns based off the source root of the app and its dependencies
 * @param dirPath workspace relative directory path that will be used to infer the parent project and dependencies
 * @param fileGlobPattern pass a custom glob pattern to be used
 * @param options.includeLibraryBuilderEntryPoints also scan the directories of the package.json export subpaths that the Angular library builder compiles
 */
export function createGlobPatternsForDependencies(
  dirPath: string,
  fileGlobPattern: string,
  options?: { includeLibraryBuilderEntryPoints?: boolean }
): string[] {
  let ig = configureIgnore();
  const filenameRelativeToWorkspaceRoot = normalizePath(
    relative(workspaceRoot, dirPath)
  );
  const projectGraph = readCachedProjectGraph();
  const projectRootMappings = createProjectRootMappings(projectGraph.nodes);

  // find the project
  let projectName;
  try {
    projectName = findProjectForPath(
      filenameRelativeToWorkspaceRoot,
      projectRootMappings
    );

    if (!projectName) {
      throw new Error(
        `createGlobPatternsForDependencies: Could not find any project containing the file "${filenameRelativeToWorkspaceRoot}" among it's project files`
      );
    }
  } catch (e) {
    throw new Error(
      `createGlobPatternsForDependencies: Error when trying to determine main project.\n${e?.message}`
    );
  }

  // generate the glob
  try {
    const dirsToUse = [];
    // Angular secondary entry points live in a directory with an
    // ng-package.json or, with the library builder, in the directory of a
    // package.json export subpath.
    const recursiveScanDirs = (dirPath, exportDirs: Set<string>) => {
      const children = readdirSync(resolve(workspaceRoot, dirPath));
      for (const child of children) {
        const childPath = join(dirPath, child);
        if (
          ig?.ignores(childPath) ||
          !lstatSync(resolve(workspaceRoot, childPath)).isDirectory()
        ) {
          continue;
        }
        if (
          exportDirs.has(childPath) ||
          existsSync(join(workspaceRoot, childPath, 'ng-package.json'))
        ) {
          dirsToUse.push(childPath);
        } else {
          recursiveScanDirs(childPath, exportDirs);
        }
      }
    };

    for (const dependency of findAllProjectNodeDependencies(
      projectName,
      projectGraph
    )) {
      const project = projectGraph.nodes[dependency].data;
      const srcDir = getProjectSourceRoot(project);
      dirsToUse.push(srcDir);
      const root = dirname(srcDir);
      recursiveScanDirs(
        root,
        new Set(
          options?.includeLibraryBuilderEntryPoints
            ? readEntryPointExportDirs(project.root)
            : []
        )
      );
    }

    // A dependency whose sourceRoot is its project root would otherwise scan its
    // node_modules, where pnpm workspace symlinks fan out across the repo.
    return [
      ...dirsToUse.map((sourceDir) =>
        resolve(workspaceRoot, joinPathFragments(sourceDir, fileGlobPattern))
      ),
      ...dirsToUse.map(
        (sourceDir) =>
          `!${resolve(workspaceRoot, joinPathFragments(sourceDir, '**/node_modules/**'))}`
      ),
    ];
  } catch (e) {
    throw new Error(
      `createGlobPatternsForDependencies: Error when generating globs.\n${e?.message}`
    );
  }
}

function readEntryPointExportDirs(projectRoot: string): string[] {
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');
  let exports: unknown;
  try {
    exports = existsSync(packageJsonPath)
      ? readJsonFile(packageJsonPath).exports
      : undefined;
  } catch {
    // A malformed package.json fails the library's build, not the Tailwind config.
    return [];
  }
  if (!exports || typeof exports !== 'object' || Array.isArray(exports)) {
    return [];
  }
  const dirs: string[] = [];
  for (const [key, value] of Object.entries(exports)) {
    const subpath = key.replace(/\/+$/, '');
    const target = resolveExportTarget(value);
    if (
      subpath.startsWith('./') &&
      target &&
      isEntryPointDirectoryExport(subpath, target)
    ) {
      dirs.push(join(projectRoot, subpath));
    }
  }
  return dirs;
}
