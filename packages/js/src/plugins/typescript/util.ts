import { readJsonFile, type TargetConfiguration } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { type PackageManagerCommands } from 'nx/src/utils/package-manager';
import { join } from 'path';
import { type ParsedCommandLine } from 'typescript';
import picomatch = require('picomatch');

export type ExtendedConfigFile = {
  filePath: string;
  externalPackage?: string;
};
export type ParsedTsconfigData = Pick<
  ParsedCommandLine,
  'options' | 'projectReferences' | 'raw'
> & {
  extendedConfigFiles: ExtendedConfigFile[];
};

/**
 * Allow uses that use incremental builds to run `nx watch-deps` to continuously build all dependencies.
 */
export function addBuildAndWatchDepsTargets(
  workspaceRoot: string,
  projectRoot: string,
  targets: Record<string, TargetConfiguration>,
  options: { buildDepsTargetName?: string; watchDepsTargetName?: string },
  pmc: PackageManagerCommands
): void {
  let projectName: string;

  const projectJsonPath = join(workspaceRoot, projectRoot, 'project.json');
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');

  if (existsSync(projectJsonPath)) {
    const projectJson = readJsonFile(projectJsonPath);
    projectName = projectJson.name;
  } else if (existsSync(packageJsonPath)) {
    const packageJson = readJsonFile(packageJsonPath);
    projectName = packageJson.nx?.name ?? packageJson.name;
  }

  if (!projectName) return;

  if (projectName) {
    const buildDepsTargetName = options.buildDepsTargetName ?? 'build-deps';
    targets[buildDepsTargetName] = {
      dependsOn: ['^build'],
    };
    targets[options.watchDepsTargetName ?? 'watch-deps'] = {
      continuous: true,
      dependsOn: [buildDepsTargetName],
      command: `${pmc.exec} nx watch --projects ${projectName} --includeDependentProjects -- ${pmc.exec} nx ${buildDepsTargetName} ${projectName}`,
    };
  }
}

export function isValidPackageJsonBuildConfig(
  tsConfig: ParsedTsconfigData,
  workspaceRoot: string,
  projectRoot: string
): boolean {
  const resolvedProjectPath = isAbsolute(projectRoot)
    ? relative(workspaceRoot, projectRoot)
    : projectRoot;
  const packageJsonPath = join(
    workspaceRoot,
    resolvedProjectPath,
    'package.json'
  );
  if (!existsSync(packageJsonPath)) {
    // If the package.json file does not exist.
    // Assume it's valid because it would be using `project.json` instead.
    return true;
  }
  const packageJson = readJsonFile(packageJsonPath);

  const projectAbsolutePath = resolve(workspaceRoot, resolvedProjectPath);

  // Handle outFile first (has precedence over outDir)
  if (tsConfig.options.outFile) {
    const outFile = resolve(
      workspaceRoot,
      resolvedProjectPath,
      tsConfig.options.outFile
    );
    const relativeToProject = relative(projectAbsolutePath, outFile);

    // If outFile is outside project root: buildable
    if (relativeToProject.startsWith('..')) {
      return true;
    }
    // If outFile is inside project root: check if entry points point to outFile

    const isPathSourceFile = (path: string): boolean => {
      const normalizedPath = isAbsolute(path)
        ? resolve(workspaceRoot, path.startsWith('/') ? path.slice(1) : path)
        : resolve(workspaceRoot, resolvedProjectPath, path);

      // For outFile case, check if path points to the specific outFile
      return normalizedPath === outFile;
    };

    // Check if any entry points match the outFile
    const exports = packageJson?.exports;
    if (exports) {
      if (typeof exports === 'string') {
        return !isPathSourceFile(exports);
      }
      if (typeof exports === 'object' && '.' in exports) {
        const dotExport = exports['.'];
        if (typeof dotExport === 'string') {
          return !isPathSourceFile(dotExport);
        } else if (typeof dotExport === 'object') {
          const hasMatch = Object.entries(dotExport).some(([key, value]) => {
            if (key === 'types' || key === 'development') return false;
            return typeof value === 'string' && isPathSourceFile(value);
          });
          return !hasMatch;
        }
      }
    }

    const buildPaths = ['main', 'module'];
    for (const field of buildPaths) {
      if (packageJson[field] && isPathSourceFile(packageJson[field])) {
        return false;
      }
    }
    return true;
  }

  // Handle outDir
  const outDir = tsConfig.options.outDir;
  let resolvedOutDir: string | undefined;
  if (outDir) {
    const potentialOutDir = resolve(workspaceRoot, resolvedProjectPath, outDir);
    const relativePath = relative(projectAbsolutePath, potentialOutDir);

    // If outDir is outside project root: buildable
    if (relativePath.startsWith('..')) {
      return true;
    }

    // If outDir is inside project root, then we should check entry points
    if (!relativePath.startsWith('..')) {
      resolvedOutDir = potentialOutDir;
    }
  }

  const isPathSourceFile = (path: string): boolean => {
    const normalizedPath = isAbsolute(path)
      ? resolve(workspaceRoot, path.startsWith('/') ? path.slice(1) : path)
      : resolve(workspaceRoot, resolvedProjectPath, path);

    if (resolvedOutDir) {
      // If the path is within the outDir, we assume it's not a source file.
      const relativePath = relative(resolvedOutDir, normalizedPath);
      if (!relativePath.startsWith('..')) {
        return false;
      }
    }

    // If no include patterns, TypeScript includes all TS files by default
    const include = tsConfig.raw?.include;
    if (!include || !Array.isArray(include)) {
      const ext = extname(path);
      const tsExtensions = ['.ts', '.tsx', '.cts', '.mts'];
      if (tsExtensions.includes(ext)) {
        return true;
      }
      // If include is not defined and it's not a TS file, assume it's not a source file
      return false;
    }

    const projectAbsolutePath = resolve(workspaceRoot, resolvedProjectPath);
    const relativeToProject = relative(projectAbsolutePath, normalizedPath);

    for (const pattern of include) {
      if (picomatch(pattern)(relativeToProject)) {
        return true;
      }
    }

    return false;
  };

  const containsInvalidPath = (
    value: string | Record<string, string>
  ): boolean => {
    if (typeof value === 'string') {
      return isPathSourceFile(value);
    } else if (typeof value === 'object') {
      return Object.entries(value).some(([currentKey, subValue]) => {
        // Skip types and development conditions
        if (currentKey === 'types' || currentKey === 'development') {
          return false;
        }
        if (typeof subValue === 'string') {
          return isPathSourceFile(subValue);
        }
        return false;
      });
    }
    return false;
  };

  const exports = packageJson?.exports;

  // Check the `.` export if `exports` is defined.
  if (exports) {
    if (typeof exports === 'string') {
      return !isPathSourceFile(exports);
    }
    if (typeof exports === 'object' && '.' in exports) {
      return !containsInvalidPath(exports['.']);
    }

    // Check other exports if `.` is not defined or valid.
    for (const key in exports) {
      if (key !== '.' && containsInvalidPath(exports[key])) {
        return false;
      }
    }

    return true;
  }

  // If `exports` is not defined, fallback to `main` and `module` fields.
  const buildPaths = ['main', 'module'];
  for (const field of buildPaths) {
    if (packageJson[field] && isPathSourceFile(packageJson[field])) {
      return false;
    }
  }

  return true;
}
