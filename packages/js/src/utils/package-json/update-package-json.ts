// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import {
  createLockFile,
  getLockFileName,
} from 'nx/src/plugins/js/lock-file/lock-file';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { createPackageJson } from 'nx/src/plugins/js/package-json/create-package-json';

import {
  detectPackageManager,
  ExecutorContext,
  getOutputsForTargetAndConfiguration,
  joinPathFragments,
  logger,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
  readJsonFile,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { DependentBuildableProjectNode } from '../buildable-libs-utils';
import { existsSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, parse, relative } from 'path';
import { fileExists } from 'nx/src/utils/fileutils';
import type { PackageJson } from 'nx/src/utils/package-json';
import { readFileMapCache } from 'nx/src/project-graph/nx-deps-cache';

import { getRelativeDirectoryToProjectRoot } from '../get-main-file-dir';

export type SupportedFormat = 'cjs' | 'esm';

export interface UpdatePackageJsonOption {
  rootDir?: string;
  projectRoot: string;
  main: string;
  additionalEntryPoints?: string[];
  format?: SupportedFormat[];
  outputPath: string;
  outputFileName?: string;
  outputFileExtensionForCjs?: `.${string}`;
  outputFileExtensionForEsm?: `.${string}`;
  skipTypings?: boolean;
  generateExportsField?: boolean;
  excludeLibsInPackageJson?: boolean;
  updateBuildableProjectDepsInPackageJson?: boolean;
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  generateLockfile?: boolean;
  packageJsonPath?: string;
}

export function updatePackageJson(
  options: UpdatePackageJsonOption,
  context: ExecutorContext,
  target: ProjectGraphProjectNode,
  dependencies: DependentBuildableProjectNode[],
  fileMap: ProjectFileMap = null
): void {
  let packageJson: PackageJson;
  if (fileMap == null) {
    fileMap = readFileMapCache()?.fileMap?.projectFileMap || {};
  }

  if (options.updateBuildableProjectDepsInPackageJson) {
    packageJson = createPackageJson(
      context.projectName,
      context.projectGraph,
      {
        target: context.targetName,
        root: context.root,
        // By default we remove devDependencies since this is a production build.
        isProduction: true,
      },
      fileMap
    );

    if (options.excludeLibsInPackageJson) {
      dependencies = dependencies.filter((dep) => dep.node.type !== 'lib');
    }

    addMissingDependencies(
      packageJson,
      context,
      dependencies,
      options.buildableProjectDepsInPackageJsonType
    );
  } else {
    const pathToPackageJson = join(
      context.root,
      options.projectRoot,
      'package.json'
    );
    packageJson = fileExists(pathToPackageJson)
      ? readJsonFile(pathToPackageJson)
      : { name: context.projectName, version: '0.0.1' };
  }

  if (packageJson.type === 'module') {
    if (options.format?.includes('cjs')) {
      logger.warn(
        `Package type is set to "module" but "cjs" format is included. Going to use "esm" format instead. You can change the package type to "commonjs" or remove type in the package.json file.`
      );
    }
    options.format = ['esm'];
  } else if (packageJson.type === 'commonjs') {
    if (options.format?.includes('esm')) {
      logger.warn(
        `Package type is set to "commonjs" but "esm" format is included. Going to use "cjs" format instead. You can change the package type to "module" or remove type in the package.json file.`
      );
    }
    options.format = ['cjs'];
  }

  // update package specific settings
  packageJson = getUpdatedPackageJsonContent(packageJson, options);

  // save files
  writeJsonFile(`${options.outputPath}/package.json`, packageJson);

  if (options.generateLockfile) {
    const packageManager = detectPackageManager(context.root);
    if (packageManager === 'bun') {
      logger.warn(
        `Bun lockfile generation is unsupported. Remove "generateLockfile" option or set it to false.`
      );
    } else {
      const lockFile = createLockFile(
        packageJson,
        context.projectGraph,
        packageManager
      );
      writeFileSync(
        `${options.outputPath}/${getLockFileName(packageManager)}`,
        lockFile,
        {
          encoding: 'utf-8',
        }
      );
    }
  }
}

function isNpmNode(
  node: ProjectGraphProjectNode | ProjectGraphExternalNode,
  graph: ProjectGraph
): node is ProjectGraphExternalNode {
  return !!(graph.externalNodes[node.name]?.type === 'npm');
}

function isWorkspaceProject(
  node: ProjectGraphProjectNode | ProjectGraphExternalNode,
  graph: ProjectGraph
): node is ProjectGraphProjectNode {
  return !!graph.nodes[node.name];
}

function addMissingDependencies(
  packageJson: PackageJson,
  {
    projectName,
    targetName,
    configurationName,
    root,
    projectGraph,
  }: ExecutorContext,
  dependencies: DependentBuildableProjectNode[],
  propType: 'dependencies' | 'peerDependencies' = 'dependencies'
) {
  const workspacePackageJson = readJsonFile(
    joinPathFragments(workspaceRoot, 'package.json')
  );
  dependencies.forEach((entry) => {
    if (isNpmNode(entry.node, projectGraph)) {
      const { packageName, version } = entry.node.data;
      if (
        packageJson.dependencies?.[packageName] ||
        packageJson.devDependencies?.[packageName] ||
        packageJson.peerDependencies?.[packageName]
      ) {
        return;
      }
      if (workspacePackageJson.devDependencies?.[packageName]) {
        return;
      }

      packageJson[propType] ??= {};
      packageJson[propType][packageName] = version;
    } else if (isWorkspaceProject(entry.node, projectGraph)) {
      const packageName = entry.name;
      if (!!workspacePackageJson.devDependencies?.[packageName]) {
        return;
      }

      if (
        !packageJson.dependencies?.[packageName] &&
        !packageJson.devDependencies?.[packageName] &&
        !packageJson.peerDependencies?.[packageName]
      ) {
        const outputs = getOutputsForTargetAndConfiguration(
          {
            project: projectName,
            target: targetName,
            configuration: configurationName,
          },
          {},
          entry.node
        );

        const depPackageJsonPath = join(root, outputs[0], 'package.json');

        if (existsSync(depPackageJsonPath)) {
          const version = readJsonFile(depPackageJsonPath).version;

          packageJson[propType] ??= {};
          packageJson[propType][packageName] = version;
        }
      }
    }
  });
}

interface Exports {
  '.': string;

  [name: string]: string;
}

export function getExports(
  options: Pick<
    UpdatePackageJsonOption,
    | 'main'
    | 'rootDir'
    | 'projectRoot'
    | 'outputFileName'
    | 'additionalEntryPoints'
    | 'outputPath'
    | 'packageJsonPath'
  > & {
    fileExt: string;
  }
): Exports {
  const outputDir = getOutputDir(options);
  const mainFile = options.outputFileName
    ? options.outputFileName.replace(/\.[tj]s$/, '')
    : basename(options.main).replace(/\.[tj]s$/, '');
  const exports: Exports = {
    '.': outputDir + mainFile + options.fileExt,
  };

  if (options.additionalEntryPoints) {
    const jsRegex = /\.[jt]sx?$/;

    for (const file of options.additionalEntryPoints) {
      const { ext: fileExt, name: fileName } = parse(file);
      const relativeDir = getRelativeDirectoryToProjectRoot(
        file,
        options.projectRoot
      );
      const sourceFilePath = relativeDir + fileName;
      const entryRelativeDir = relativeDir.replace(/^\.\/src\//, './');
      const entryFilepath = entryRelativeDir + fileName;
      const isJsFile = jsRegex.test(fileExt);
      if (isJsFile && fileName === 'index') {
        const barrelEntry = entryRelativeDir.replace(/\/$/, '');
        exports[barrelEntry] = sourceFilePath + options.fileExt;
      }
      exports[isJsFile ? entryFilepath : entryFilepath + fileExt] =
        sourceFilePath + (isJsFile ? options.fileExt : fileExt);
    }
  }

  return exports;
}

export function getUpdatedPackageJsonContent(
  packageJson: PackageJson,
  options: UpdatePackageJsonOption
): PackageJson {
  // Default is CJS unless esm is explicitly passed.
  const hasCjsFormat = !options.format || options.format?.includes('cjs');
  const hasEsmFormat = options.format?.includes('esm');

  if (options.generateExportsField) {
    packageJson.exports ??=
      typeof packageJson.exports === 'string' ? {} : { ...packageJson.exports };
    packageJson.exports['./package.json'] ??= './package.json';
  }

  if (!options.skipTypings) {
    const mainFile = basename(options.main).replace(/\.[tj]s$/, '');
    const outputDir = getOutputDir(options);
    const typingsFile = `${outputDir}${mainFile}.d.ts`;
    packageJson.types ??= typingsFile;

    if (options.generateExportsField) {
      if (!packageJson.exports['.']) {
        packageJson.exports['.'] = { types: typingsFile };
      } else if (
        typeof packageJson.exports['.'] === 'object' &&
        !packageJson.exports['.'].types
      ) {
        packageJson.exports['.'].types = typingsFile;
      }
    }
  }

  if (hasEsmFormat) {
    const esmExports = getExports({
      ...options,
      fileExt: options.outputFileExtensionForEsm ?? '.js',
    });

    packageJson.module ??= esmExports['.'];

    if (!hasCjsFormat) {
      packageJson.type ??= 'module';
      packageJson.main ??= esmExports['.'];
    }

    if (options.generateExportsField) {
      for (const [exportEntry, filePath] of Object.entries(esmExports)) {
        if (!packageJson.exports[exportEntry]) {
          packageJson.exports[exportEntry] ??= hasCjsFormat
            ? { import: filePath }
            : filePath;
        } else if (typeof packageJson.exports[exportEntry] === 'object') {
          packageJson.exports[exportEntry].import ??= filePath;
        }
      }
    }
  }

  // CJS output may have .cjs or .js file extensions.
  // Bundlers like rollup and esbuild supports .cjs for CJS and .js for ESM.
  // Bundlers/Compilers like webpack, tsc, swc do not have different file extensions (unless you use .mts or .cts in source).
  if (hasCjsFormat) {
    const cjsExports = getExports({
      ...options,
      fileExt: options.outputFileExtensionForCjs ?? '.js',
    });

    packageJson.main ??= cjsExports['.'];
    if (!hasEsmFormat) {
      packageJson.type ??= 'commonjs';
    }

    if (options.generateExportsField) {
      for (const [exportEntry, filePath] of Object.entries(cjsExports)) {
        if (!packageJson.exports[exportEntry]) {
          packageJson.exports[exportEntry] ??= hasEsmFormat
            ? { default: filePath }
            : filePath;
        } else if (typeof packageJson.exports[exportEntry] === 'object') {
          packageJson.exports[exportEntry].default ??= filePath;
        }
      }
    }
  }

  return packageJson;
}

export function getOutputDir(
  options: Pick<
    UpdatePackageJsonOption,
    | 'main'
    | 'rootDir'
    | 'projectRoot'
    | 'outputFileName'
    | 'outputPath'
    | 'packageJsonPath'
  >
): string {
  const packageJsonDir = options.packageJsonPath
    ? dirname(options.packageJsonPath)
    : options.outputPath;
  const relativeOutputPath = relative(packageJsonDir, options.outputPath);
  const relativeMainDir = options.outputFileName
    ? ''
    : relative(options.rootDir ?? options.projectRoot, dirname(options.main));
  const outputDir = join(relativeOutputPath, relativeMainDir);

  return outputDir === '.' ? `./` : `./${outputDir}/`;
}
