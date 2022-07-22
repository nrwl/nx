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
import { basename, dirname, join, relative } from 'path';
import { NormalizedExecutorOptions } from './schema';
import { fileExists } from 'nx/src/utils/fileutils';

function getMainFileDirRelativeToProjectRoot(
  main: string,
  projectRoot: string
): string {
  const mainFileDir = dirname(main);
  const relativeDir = normalizePath(relative(projectRoot, mainFileDir));
  return relativeDir === '' ? `./` : `./${relativeDir}/`;
}

export function updatePackageJson(
  options: NormalizedExecutorOptions,
  context: ExecutorContext,
  target: ProjectGraphProjectNode<any>,
  dependencies: DependentBuildableProjectNode[],
  withTypings = true
): void {
  const pathToPackageJson = join(
    context.root,
    options.projectRoot,
    'package.json'
  );

  const packageJson = fileExists(pathToPackageJson)
    ? readJsonFile(pathToPackageJson)
    : { name: context.projectName };

  const mainFile = basename(options.main).replace(/\.[tj]s$/, '');
  const relativeMainFileDir = getMainFileDirRelativeToProjectRoot(
    options.main,
    options.projectRoot
  );
  const mainJsFile = `${relativeMainFileDir}${mainFile}.js`;
  const typingsFile = `${relativeMainFileDir}${mainFile}.d.ts`;

  packageJson.main = packageJson.main ?? mainJsFile;

  if (withTypings) {
    packageJson.typings = packageJson.typings ?? typingsFile;
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
