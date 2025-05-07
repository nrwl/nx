import { readJsonFile, type TargetConfiguration } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { type PackageManagerCommands } from 'nx/src/utils/package-manager';
import { join } from 'path';
import { type ParsedCommandLine } from 'typescript';

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

  const outDir = tsConfig.options.outFile
    ? dirname(tsConfig.options.outFile)
    : tsConfig.options.outDir;
  const resolvedOutDir = outDir
    ? resolve(workspaceRoot, resolvedProjectPath, outDir)
    : undefined;

  const isPathSourceFile = (path: string): boolean => {
    if (resolvedOutDir) {
      const pathToCheck = resolve(workspaceRoot, resolvedProjectPath, path);
      return !pathToCheck.startsWith(resolvedOutDir);
    }

    const ext = extname(path);
    // Check that the file extension is a TS file extension. As the source files are in the same directory as the output files.
    return ['.ts', '.tsx', '.cts', '.mts'].includes(ext);
  };

  // Checks if the value is a path within the `src` directory.
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
