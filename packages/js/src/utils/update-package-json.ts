import { normalizePath } from '@nrwl/devkit';
import { readJsonFile, writeJsonFile } from '@nrwl/tao/src/utils/fileutils';
import { basename, dirname, join, relative } from 'path';

function getMainFileDirRelativeToProjectRoot(
  main: string,
  projectRoot: string
): string {
  const mainFileDir = dirname(main);
  const relativeDir = normalizePath(relative(projectRoot, mainFileDir));
  return relativeDir === '' ? `./` : `./${relativeDir}/`;
}

export function updatePackageJson(
  main: string,
  outputPath: string,
  projectRoot: string,
  withTypings = true
): void {
  const packageJson = readJsonFile(join(projectRoot, 'package.json'));
  if (packageJson.main && packageJson.typings) {
    return;
  }

  const mainFile = basename(main).replace(/\.[tj]s$/, '');
  const relativeMainFileDir = getMainFileDirRelativeToProjectRoot(
    main,
    projectRoot
  );
  const mainJsFile = `${relativeMainFileDir}${mainFile}.js`;
  const typingsFile = `${relativeMainFileDir}${mainFile}.d.ts`;

  packageJson.main = packageJson.main ?? mainJsFile;

  if (withTypings) {
    packageJson.typings = packageJson.typings ?? typingsFile;
  }

  const outputPackageJson = join(outputPath, 'package.json');
  writeJsonFile(outputPackageJson, packageJson);
}
