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

  const exports = {
    '.': {},
  };

  if (hasEsmFormat) {
    // `module` field is used by bundlers like rollup and webpack to detect ESM.
    // May not be required in the future if type is already "module".
    packageJson.module = './index.esm.js';
    exports['.']['import'] = './index.esm.js';

    if (!hasCjsFormat) {
      packageJson.main = './index.esm.js';
    }
  }

  if (hasCjsFormat) {
    packageJson.main = './index.cjs.js';
    exports['.']['default'] = './index.cjs.js';
  }

  // Dual format should not specify `type` field, the `exports` field resolves ESM vs CJS.
  if (!options.skipTypeField && options.format.length === 1) {
    packageJson.type = options.format.includes('esm') ? 'module' : 'commonjs';
  }

  if (options.generateExportsField && typeof packageJson.exports !== 'string') {
    packageJson.exports = {
      './package.json': './package.json',
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
