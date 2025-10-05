import { readJsonFile, type TargetConfiguration } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { type PackageManagerCommands } from 'nx/src/utils/package-manager';
import type { PackageJson } from 'packages/nx/src/utils/package-json';
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
  const projectAbsolutePath = resolve(workspaceRoot, resolvedProjectPath);
  const packageJsonPath = join(projectAbsolutePath, 'package.json');

  if (!existsSync(packageJsonPath)) {
    // If the package.json file does not exist.
    // Assume it's valid because it would be using `project.json` instead.
    return true;
  }

  const packageJson = readJsonFile<PackageJson>(packageJsonPath);

  // Check entry points against outFile (has precedence over outDir)
  if (tsConfig.options.outFile) {
    return isAnyEntryPointPointingToOutFile(
      packageJson,
      tsConfig,
      projectAbsolutePath,
      workspaceRoot
    );
  }

  // Check entry points against outDir
  const outDir = tsConfig.options.outDir;
  if (outDir) {
    return isAnyEntryPointPointingToOutDir(
      packageJson,
      outDir,
      workspaceRoot,
      projectAbsolutePath
    );
  }

  // Check entry points against include patterns
  return isAnyEntryPointPointingToNonIncludedFiles(
    packageJson,
    tsConfig,
    workspaceRoot,
    projectAbsolutePath
  );
}

const packageJsonLegacyEntryPoints = ['main', 'module'];

function isAnyEntryPointPointingToOutFile(
  packageJson: PackageJson,
  tsConfig: ParsedTsconfigData,
  projectAbsolutePath: string,
  workspaceRoot: string
): boolean {
  const outFile = resolve(projectAbsolutePath, tsConfig.options.outFile);
  const relativeToProject = relative(projectAbsolutePath, outFile);

  // If outFile is outside project root: buildable
  if (relativeToProject.startsWith('..')) {
    return true;
  }

  // If outFile is inside project root: check if entry points point to outFile
  const isPathPointingToOutputFile = (path: string): boolean => {
    return normalizePath(path, workspaceRoot, projectAbsolutePath) === outFile;
  };

  const exports = packageJson.exports;
  if (!exports) {
    // If any entry point points to the outFile, or if no entry points are
    // defined (Node.js falls back to `./index.js`), then it's buildable
    return (
      packageJsonLegacyEntryPoints.some(
        (field) =>
          packageJson[field] && isPathPointingToOutputFile(packageJson[field])
      ) || packageJsonLegacyEntryPoints.every((field) => !packageJson[field])
    );
  }

  if (typeof exports === 'string') {
    return isPathPointingToOutputFile(exports);
  }

  const isExportsEntryPointingToOutFile = (
    value: string | Record<string, string>
  ): boolean => {
    if (typeof value === 'string') {
      return isPathPointingToOutputFile(value);
    }

    if (typeof value === 'object') {
      return Object.values(value).some(
        (subValue) =>
          typeof subValue === 'string' && isPathPointingToOutputFile(subValue)
      );
    }

    return false;
  };

  if ('.' in exports && exports['.'] !== null) {
    return isExportsEntryPointingToOutFile(exports['.']);
  }

  // If any export is pointing to a path inside the outDir, then it's buildable
  return Object.keys(exports).some(
    (key) => key !== '.' && isExportsEntryPointingToOutFile(exports[key])
  );
}

function isAnyEntryPointPointingToOutDir(
  packageJson: PackageJson,
  outDir: string,
  workspaceRoot: string,
  projectAbsolutePath: string
): boolean {
  const resolvedOutDir = resolve(projectAbsolutePath, outDir);
  const relativePath = relative(projectAbsolutePath, resolvedOutDir);

  // If outDir is outside project root: buildable
  if (relativePath.startsWith('..')) {
    return true;
  }

  const isPathInsideOutDir = (path: string): boolean => {
    const normalizedPath = normalizePath(
      path,
      workspaceRoot,
      projectAbsolutePath
    );

    return !relative(resolvedOutDir, normalizedPath).startsWith('..');
  };

  const exports = packageJson.exports;
  if (!exports) {
    // If any entry point points to a path inside the outDir, or if no entry points
    // are defined (Node.js falls back to `./index.js`), then it's buildable
    return (
      packageJsonLegacyEntryPoints.some(
        (field) =>
          packageJson[field] &&
          packageJson[field] !== './package.json' &&
          isPathInsideOutDir(packageJson[field])
      ) || packageJsonLegacyEntryPoints.every((field) => !packageJson[field])
    );
  }

  if (typeof exports === 'string') {
    return isPathInsideOutDir(exports);
  }

  const isExportsEntryPointingToPathInsideOutDir = (
    value: string | Record<string, string>
  ): boolean => {
    if (typeof value === 'string') {
      return isPathInsideOutDir(value);
    }

    if (typeof value === 'object') {
      return Object.values(value).some(
        (subValue) =>
          typeof subValue === 'string' && isPathInsideOutDir(subValue)
      );
    }

    return false;
  };

  if ('.' in exports && exports['.'] !== null) {
    return isExportsEntryPointingToPathInsideOutDir(exports['.']);
  }

  // If any export is pointing to a path inside the outDir, then it's buildable
  return Object.keys(exports).some(
    (key) =>
      key !== '.' &&
      key !== './package.json' &&
      isExportsEntryPointingToPathInsideOutDir(exports[key])
  );
}

function isAnyEntryPointPointingToNonIncludedFiles(
  packageJson: PackageJson,
  tsConfig: ParsedTsconfigData,
  workspaceRoot: string,
  projectAbsolutePath: string
): boolean {
  const isPathSourceFile = (path: string): boolean => {
    const normalizedPath = normalizePath(
      path,
      workspaceRoot,
      projectAbsolutePath
    );

    const files = tsConfig.raw?.files;
    const include = tsConfig.raw?.include;

    if (Array.isArray(files)) {
      const match = files.find(
        (file) =>
          normalizePath(file, workspaceRoot, projectAbsolutePath) ===
          normalizedPath
      );

      if (match) {
        return true;
      }
    }

    // If not matched by `files`, check `include` patterns
    if (!Array.isArray(include)) {
      // If no include patterns, TypeScript includes all TS files by default
      const ext = extname(path);
      const tsExtensions = ['.ts', '.tsx', '.cts', '.mts'];
      return tsExtensions.includes(ext);
    }

    const relativeToProject = relative(projectAbsolutePath, normalizedPath);

    return include.some((pattern) => picomatch(pattern)(relativeToProject));
  };

  // Check the `.` export if `exports` is defined.
  const exports = packageJson.exports;
  if (!exports) {
    // If any entry point doesn't point to a source file, or if no entry points
    // are defined (Node.js falls back to `./index.js`), then it's buildable
    return (
      packageJsonLegacyEntryPoints.some(
        (field) => packageJson[field] && !isPathSourceFile(packageJson[field])
      ) || packageJsonLegacyEntryPoints.every((field) => !packageJson[field])
    );
  }

  if (typeof exports === 'string') {
    return !isPathSourceFile(exports);
  }

  const isExportsEntryPointingToSource = (
    value: string | Record<string, string>
  ): boolean => {
    if (typeof value === 'string') {
      return isPathSourceFile(value);
    }

    if (typeof value === 'object') {
      // entry point point to a source file if all conditions that are not set
      // to `null` point to a source file
      return Object.values(value).every(
        (subValue) => typeof subValue !== 'string' || isPathSourceFile(subValue)
      );
    }

    return false;
  };

  if ('.' in exports && exports['.'] !== null) {
    return !isExportsEntryPointingToSource(exports['.']);
  }

  // If any export is not pointing to a source file, then it's buildable
  return Object.keys(exports).some(
    (key) =>
      key !== '.' &&
      key !== './package.json' &&
      !isExportsEntryPointingToSource(exports[key])
  );
}

function normalizePath(
  path: string,
  workspaceRoot: string,
  projectAbsolutePath: string
): string {
  return isAbsolute(path)
    ? resolve(workspaceRoot, path.startsWith('/') ? path.slice(1) : path)
    : resolve(projectAbsolutePath, path);
}
