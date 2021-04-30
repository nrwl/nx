import { ExecutorContext, normalizePath } from '@nrwl/devkit';
import { basename, dirname, join, relative } from 'path';
import { copyAssets } from '../../utilities/assets';
import { readJsonFile, writeJsonFile } from '../../utilities/fileutils';
import { compileTypeScript } from '../../utilities/typescript/compilation';
import { TypeScriptExecutorOptions } from './schema';

export async function tscExecutor(
  options: TypeScriptExecutorOptions,
  context: ExecutorContext
) {
  const normalizedOptions = normalizeOptions(options, context);
  const projectRoot = context.workspace.projects[context.projectName].root;

  const result = compileTypeScript({
    outputPath: normalizedOptions.outputPath,
    projectName: context.projectName,
    projectRoot,
    tsConfig: normalizedOptions.tsConfig,
  });

  if (result.success) {
    await copyAssets(
      normalizedOptions.assets,
      context.root,
      normalizedOptions.outputPath
    );
    updatePackageJson(normalizedOptions, projectRoot);
  }

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
