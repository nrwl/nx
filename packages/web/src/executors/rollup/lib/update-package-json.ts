import { relative } from 'path';
import { ExecutorContext } from 'nx/src/config/misc-interfaces';
import { ProjectGraphProjectNode } from 'nx/src/config/project-graph';
import {
  DependentBuildableProjectNode,
  updateBuildableProjectPackageJsonDependencies,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { writeJsonFile } from 'nx/src/utils/fileutils';
import { PackageJson } from 'nx/src/utils/package-json';
import { NormalizedWebRollupOptions } from './normalize';

export function updatePackageJson(
  options: NormalizedWebRollupOptions,
  context: ExecutorContext,
  target: ProjectGraphProjectNode,
  dependencies: DependentBuildableProjectNode[],
  packageJson: PackageJson
) {
  const hasEsmFormat = options.format.includes('esm');
  const hasCjsFormat =
    options.format.includes('umd') || options.format.includes('cjs');

  const types = `./${relative(options.entryRoot, options.entryFile).replace(
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

  // TODO(jack): remove this for Nx 15
  if (options.generateExportsField) {
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
