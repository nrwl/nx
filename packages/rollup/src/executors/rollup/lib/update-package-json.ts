import { basename, dirname, parse, relative } from 'path';
import { ExecutorContext } from 'nx/src/config/misc-interfaces';
import { ProjectGraphProjectNode } from 'nx/src/config/project-graph';
import {
  DependentBuildableProjectNode,
  updateBuildableProjectPackageJsonDependencies,
} from '@nx/js/src/utils/buildable-libs-utils';
import { writeJsonFile } from 'nx/src/utils/fileutils';
import { PackageJson } from 'nx/src/utils/package-json';
import { NormalizedRollupExecutorOptions } from './normalize';
import { normalizePath } from '@nx/devkit';

// TODO(jack): Use updatePackageJson from @nx/js instead.
export function updatePackageJson(
  options: NormalizedRollupExecutorOptions,
  context: ExecutorContext,
  target: ProjectGraphProjectNode,
  dependencies: DependentBuildableProjectNode[],
  packageJson: PackageJson
) {
  const hasEsmFormat = options.format.includes('esm');
  const hasCjsFormat = options.format.includes('cjs');

  if (options.generateExportsField) {
    packageJson.exports =
      typeof packageJson.exports === 'string' ? {} : { ...packageJson.exports };
    packageJson.exports['./package.json'] = './package.json';
  }

  if (hasEsmFormat) {
    const esmExports = getExports({
      ...options,
      fileExt: '.esm.js',
    });

    packageJson.module = esmExports['.'];

    if (!hasCjsFormat) {
      packageJson.type = 'module';
      packageJson.main ??= esmExports['.'];
    }

    if (options.generateExportsField) {
      for (const [exportEntry, filePath] of Object.entries(esmExports)) {
        packageJson.exports[exportEntry] = hasCjsFormat
          ? { import: filePath }
          : filePath;
      }
    }
  }

  if (hasCjsFormat) {
    const cjsExports = getExports({
      ...options,
      fileExt: '.cjs.js',
    });

    packageJson.main = cjsExports['.'];

    if (!hasEsmFormat) {
      packageJson.type = 'commonjs';
    }

    if (options.generateExportsField) {
      for (const [exportEntry, filePath] of Object.entries(cjsExports)) {
        if (hasEsmFormat) {
          packageJson.exports[exportEntry]['default'] ??= filePath;
        } else {
          packageJson.exports[exportEntry] = filePath;
        }
      }
    }
  }

  writeJsonFile(`${options.outputPath}/package.json`, packageJson);

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

interface Exports {
  '.': string;

  [name: string]: string;
}

function getExports(
  options: Pick<
    NormalizedRollupExecutorOptions,
    'main' | 'projectRoot' | 'outputFileName' | 'additionalEntryPoints'
  > & {
    fileExt: string;
  }
): Exports {
  const mainFile = options.outputFileName
    ? options.outputFileName.replace(/\.[tj]s$/, '')
    : basename(options.main).replace(/\.[tj]s$/, '');
  const exports: Exports = {
    '.': './' + mainFile + options.fileExt,
  };

  if (options.additionalEntryPoints) {
    for (const file of options.additionalEntryPoints) {
      const { name: fileName } = parse(file);
      exports['./' + fileName] = './' + fileName + options.fileExt;
    }
  }

  return exports;
}
