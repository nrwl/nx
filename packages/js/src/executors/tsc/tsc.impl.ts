import { ExecutorContext, normalizePath } from '@nrwl/devkit';
import { basename, dirname, join, relative } from 'path';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { copyAssets } from '@nrwl/workspace/src/utilities/assets';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { readJsonFile, writeJsonFile } from '@nrwl/devkit';
import { compileTypeScript } from '@nrwl/workspace/src/utilities/typescript/compilation';
import { TypeScriptExecutorOptions } from './schema';

export async function tscExecutor(
  options: TypeScriptExecutorOptions,
  context: ExecutorContext
) {
  const normalizedOptions = normalizeOptions(options, context);
  // const projectRoot = context.workspace.projects[context.projectName].root;

  const projectGraph = readCachedProjectGraph();
  const { target, dependencies } = calculateProjectDependencies(
    projectGraph,
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName
  );
  const projectRoot = target.data.root;

  if (dependencies.length > 0) {
    const areDependentProjectsBuilt = checkDependentProjectsHaveBeenBuilt(
      context.root,
      context.projectName,
      context.targetName,
      dependencies
    );
    if (!areDependentProjectsBuilt) {
      return { success: false };
    }

    normalizedOptions.tsConfig = createTmpTsConfig(
      join(context.root, options.tsConfig),
      context.root,
      projectRoot,
      dependencies
    );
  }

  // this has to happen first so the folder is created where the assets are copied into
  const result = compileTypeScript({
    outputPath: normalizedOptions.outputPath,
    projectName: context.projectName,
    projectRoot,
    tsConfig: normalizedOptions.tsConfig,
  });

  await copyAssets(
    normalizedOptions.assets,
    context.root,
    normalizedOptions.outputPath
  );
  updatePackageJson(normalizedOptions, projectRoot);

  return result;
}

function getMainFileDirRelativeToProjectRoot(
  main: string,
  projectRoot: string
): string {
  const mainFileDir = dirname(main);
  const relativeDir = normalizePath(relative(projectRoot, mainFileDir));
  const relativeMainFile = relativeDir === '' ? `./` : `./${relativeDir}/`;
  return relativeMainFile;
}

function normalizeOptions(
  options: TypeScriptExecutorOptions,
  context: ExecutorContext
): TypeScriptExecutorOptions {
  return {
    ...options,
    outputPath: join(context.root, options.outputPath),
    tsConfig: join(context.root, options.tsConfig),
  };
}

function updatePackageJson(
  options: TypeScriptExecutorOptions,
  projectRoot: string
): void {
  const packageJson = readJsonFile(join(projectRoot, 'package.json'));
  if (packageJson.main && packageJson.typings) {
    return;
  }

  const mainFile = basename(options.main).replace(/\.[tj]s$/, '');
  const relativeMainFileDir = getMainFileDirRelativeToProjectRoot(
    options.main,
    projectRoot
  );
  const mainJsFile = `${relativeMainFileDir}${mainFile}.js`;
  const typingsFile = `${relativeMainFileDir}${mainFile}.d.ts`;

  packageJson.main = packageJson.main ?? mainJsFile;
  packageJson.typings = packageJson.typings ?? typingsFile;
  const outputPackageJson = join(options.outputPath, 'package.json');
  writeJsonFile(outputPackageJson, packageJson);
}

export default tscExecutor;
