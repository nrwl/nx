import {
  createLockFile,
  createPackageJson,
  ExecutorContext,
  getOutputsForTargetAndConfiguration,
  normalizePath,
  ProjectGraphProjectNode,
  readJsonFile,
  writeJsonFile,
} from '@nrwl/devkit';
import { DependentBuildableProjectNode } from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { basename, dirname, join, parse, relative } from 'path';
import type { PackageJson } from 'nx/src/utils/package-json';
import { getLockFileName } from 'nx/src/lock-file/lock-file';
import { writeFileSync } from 'fs-extra';
import { isNpmProject } from 'nx/src/project-graph/operators';

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
  const packageJson = createPackageJson(
    context.projectName,
    context.projectGraph,
    {
      root: context.root,
      // By default we remove devDependencies since this is a production build.
      isProduction: true,
    }
  );
  // make custom modifications to package.json
  updatePackageJsonContent(packageJson, options);
  if (options.excludeLibsInPackageJson) {
    dependencies = dependencies.filter((dep) => dep.node.type !== 'lib');
  }
  if (options.updateBuildableProjectDepsInPackageJson) {
    addMissingLibDependencies(packageJson, context, dependencies);
  }

  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
  const lockFile = createLockFile(packageJson);
  writeFileSync(`${options.outputPath}/${getLockFileName()}`, lockFile, {
    encoding: 'utf-8',
  });
}

function addMissingLibDependencies(
  packageJson: PackageJson,
  { projectName, targetName, configurationName, root }: ExecutorContext,
  dependencies: DependentBuildableProjectNode[]
) {
  dependencies.forEach((entry) => {
    if (!isNpmProject(entry.node)) {
      const packageName = entry.name;
      if (
        !packageJson.dependencies?.[packageName] &&
        !packageJson.peerDependencies?.[packageName]
      ) {
        const outputs = getOutputsForTargetAndConfiguration(
          {
            overrides: {},
            target: {
              project: projectName,
              target: targetName,
              configuration: configurationName,
            },
          },
          entry.node
        );

        const depPackageJsonPath = join(root, outputs[0], 'package.json');
        const version = readJsonFile(depPackageJsonPath).version;

        packageJson.dependencies ??= {};
        packageJson.dependencies[packageName] = version;
      }
    }
  });
}

export function updatePackageJsonContent(
  packageJson: PackageJson,
  options: UpdatePackageJsonOption
): PackageJson {
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
