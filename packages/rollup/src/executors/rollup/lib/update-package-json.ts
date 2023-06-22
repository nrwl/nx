import { relative } from 'path';
import { ExecutorContext } from 'nx/src/config/misc-interfaces';
import { ProjectGraphProjectNode } from 'nx/src/config/project-graph';
import {
  DependentBuildableProjectNode,
  updateBuildableProjectPackageJsonDependencies,
} from '@nx/js/src/utils/buildable-libs-utils';
import { writeJsonFile } from 'nx/src/utils/fileutils';
import { PackageJson } from 'nx/src/utils/package-json';
import { NormalizedRollupExecutorOptions } from './normalize';

export function updatePackageJson(
  options: NormalizedRollupExecutorOptions,
  context: ExecutorContext,
  target: ProjectGraphProjectNode,
  dependencies: DependentBuildableProjectNode[],
  packageJson: PackageJson
) {
  const hasEsmFormat = options.format.includes('esm');
  const hasCjsFormat = options.format.includes('cjs');

  const types = `./${relative(options.projectRoot, options.main).replace(
    /\.[jt]sx?$/,
    '.d.ts'
  )}`;
  const exports = {
    // TS 4.5+
    '.': {
      types,
    },
  };

  if (hasEsmFormat) {
    // `module` field is used by bundlers like rollup and webpack to detect ESM.
    // May not be required in the future if type is already "module".
    packageJson.module = './index.js';
    exports['.']['import'] = './index.js';

    if (!hasCjsFormat) {
      packageJson.main = './index.js';
    }
  }

  if (hasCjsFormat) {
    packageJson.main = './index.cjs';
    exports['.']['require'] = './index.cjs';
  }
  if (!options.skipTypeField) {
    packageJson.type = options.format.includes('esm') ? 'module' : 'commonjs';
  }

  // Support for older TS versions < 4.5
  packageJson.types = types;

  // TODO(jack): remove this for Nx 16
  if (options.generateExportsField && typeof packageJson.exports !== 'string') {
    packageJson.exports = {
      ...packageJson.exports,
      ...exports,
    };
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
