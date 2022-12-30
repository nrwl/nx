import {
  ExecutorContext,
  normalizePath,
  ProjectGraphProjectNode,
  readJsonFile,
  writeJsonFile,
} from '@nrwl/devkit';
import {
  DependentBuildableProjectNode,
  updateBuildableProjectPackageJsonDependencies,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { basename, dirname, join, parse, relative } from 'path';
import { fileExists } from 'nx/src/utils/fileutils';
import type { PackageJson } from 'nx/src/utils/package-json';

function getMainFileDirRelativeToProjectRoot(
  main: string,
  projectRoot: string
): string {
  const mainFileDir = dirname(main);
  const relativeDir = normalizePath(relative(projectRoot, mainFileDir));
  return relativeDir === '' ? `./` : `./${relativeDir}/`;
}

export type SupportedFormat = 'cjs' | 'esm';

export interface UpdatePackageJsonOption {
  projectRoot: string;
  main: string;
  format?: SupportedFormat[];
  outputPath: string;
  outputFileName?: string;
  outputFileExtensionForCjs?: `.${string}`;
  skipTypings?: boolean;
  generateExportsField?: boolean;
  excludeLibsInPackageJson?: boolean;
  updateBuildableProjectDepsInPackageJson?: boolean;
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
}

export function updatePackageJson(
  options: UpdatePackageJsonOption,
  context: ExecutorContext,
  target: ProjectGraphProjectNode,
  dependencies: DependentBuildableProjectNode[]
): void {
  const pathToPackageJson = join(
    context.root,
    options.projectRoot,
    'package.json'
  );

  const packageJson = fileExists(pathToPackageJson)
    ? readJsonFile(pathToPackageJson)
    : { name: context.projectName };

  if (options.excludeLibsInPackageJson) {
    dependencies = dependencies.filter((dep) => dep.node.type !== 'lib');
  }

  writeJsonFile(
    `${options.outputPath}/package.json`,
    getUpdatedPackageJsonContent(packageJson, options)
  );

  if (
    dependencies.length > 0 &&
    options.updateBuildableProjectDepsInPackageJson
  ) {
    updateBuildableProjectPackageJsonDependencies(
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName,
      target,
      dependencies,
      options.buildableProjectDepsInPackageJsonType
    );
  }
}

export function getUpdatedPackageJsonContent(
  packageJson: PackageJson,
  options: UpdatePackageJsonOption
) {
  // Default is CJS unless esm is explicitly passed.
  const hasCjsFormat = !options.format || options.format?.includes('cjs');
  const hasEsmFormat = options.format?.includes('esm');

  const mainFile = basename(options.main).replace(/\.[tj]s$/, '');
  const relativeMainFileDir = getMainFileDirRelativeToProjectRoot(
    options.main,
    options.projectRoot
  );
  const typingsFile = `${relativeMainFileDir}${mainFile}.d.ts`;

  const exports =
    typeof packageJson.exports === 'string'
      ? packageJson.exports
      : {
          '.': {},
          ...packageJson.exports,
        };

  const mainJsFile =
    options.outputFileName ?? `${relativeMainFileDir}${mainFile}.js`;

  if (hasEsmFormat) {
    // Unofficial field for backwards compat.
    packageJson.module ??= mainJsFile;

    if (!hasCjsFormat) {
      packageJson.type = 'module';
      packageJson.main ??= mainJsFile;
    }

    if (typeof exports !== 'string') {
      if (typeof exports['.'] !== 'string') {
        exports['.']['import'] ??= mainJsFile;
      } else if (!hasCjsFormat) {
        exports['.'] ??= mainJsFile;
      }
    }
  }

  // CJS output may have .cjs or .js file extensions.
  // Bundlers like rollup and esbuild supports .cjs for CJS and .js for ESM.
  // Bundlers/Compilers like webpack, tsc, swc do not have different file extensions.
  if (hasCjsFormat) {
    const { dir, name } = parse(mainJsFile);
    const cjsMain = `${dir ? dir : '.'}/${name}${
      options.outputFileExtensionForCjs ?? '.js'
    }`;
    packageJson.main ??= cjsMain;
    if (typeof exports !== 'string') {
      if (typeof exports['.'] !== 'string') {
        exports['.']['require'] ??= cjsMain;
      } else if (!hasEsmFormat) {
        exports['.'] ??= cjsMain;
      }
    }
  }

  if (options.generateExportsField) {
    packageJson.exports = exports;
  }

  if (!options.skipTypings) {
    packageJson.types = packageJson.types ?? typingsFile;
  }

  return packageJson;
}
