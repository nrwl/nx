import { ExecutorContext } from '@nx/devkit';
import { getExtraDependencies } from '../../utils/get-extra-dependencies';
import {
  copyPackageJson,
  CopyPackageJsonOptions,
} from '../../utils/package-json';

import {
  GeneratePackageJsonExecutorOptions,
  NormalizedGeneratePackageJsonExecutorOptions,
} from './schema';

export interface GeneratePackageJsonResult {
  success?: boolean;
}

export default async function generatePackageJson(
  options: GeneratePackageJsonExecutorOptions,
  context: ExecutorContext
): Promise<GeneratePackageJsonResult> {
  const {
    main,
    buildableProjectDepsInPackageJsonType,
    excludeLibsInPackageJson,
    format,
    generateLockfile,
    outputPath,
  } = normalizeOptions(options);

  const externalDependencies = getExtraDependencies(
    context.projectName,
    context.projectGraph
  );

  const cpjOptions: CopyPackageJsonOptions = {
    outputPath,
    buildableProjectDepsInPackageJsonType,
    excludeLibsInPackageJson,
    generateLockfile,
    format: [format],
    main,
    watch: false,
    skipTypings: true,
    updateBuildableProjectDepsInPackageJson: externalDependencies.length > 0,
  };

  await copyPackageJson(cpjOptions, context);

  return {
    success: true,
  };
}

const normalizeOptions = (
  options: GeneratePackageJsonExecutorOptions
): NormalizedGeneratePackageJsonExecutorOptions => {
  const {
    buildableProjectDepsInPackageJsonType = 'dependencies',
    excludeLibsInPackageJson = true,
    format = 'esm',
    generateLockfile = true,
  } = options;
  return {
    ...options,
    buildableProjectDepsInPackageJsonType,
    excludeLibsInPackageJson,
    format,
    generateLockfile,
  };
};
