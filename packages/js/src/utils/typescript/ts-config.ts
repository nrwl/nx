import { offsetFromRoot, Tree, updateJson, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import type * as ts from 'typescript';
import { ensureTypescript } from './ensure-typescript';

let tsModule: typeof import('typescript');

export function readTsConfig(
  tsConfigPath: string,
  sys?: ts.System
): ts.ParsedCommandLine {
  if (!tsModule) {
    tsModule = require('typescript');
  }

  sys ??= tsModule.sys;

  const readResult = tsModule.readConfigFile(tsConfigPath, sys.readFile);
  return tsModule.parseJsonConfigFileContent(
    readResult.config,
    sys,
    dirname(tsConfigPath)
  );
}

export function readTsConfigFromTree(
  tree: Tree,
  tsConfigPath: string
): ts.ParsedCommandLine {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const tsSysFromTree: ts.System = {
    ...tsModule.sys,
    readFile: (path) => tree.read(path, 'utf-8'),
  };

  return readTsConfig(tsConfigPath, tsSysFromTree);
}

export function getRootTsConfigPathInTree(tree: Tree): string | null {
  for (const path of ['tsconfig.base.json', 'tsconfig.json']) {
    if (tree.exists(path)) {
      return path;
    }
  }

  return 'tsconfig.base.json';
}

export function getRelativePathToRootTsConfig(
  tree: Tree,
  targetPath: string
): string {
  return offsetFromRoot(targetPath) + getRootTsConfigPathInTree(tree);
}

export function getRootTsConfigPath(): string | null {
  const tsConfigFileName = getRootTsConfigFileName();

  return tsConfigFileName ? join(workspaceRoot, tsConfigFileName) : null;
}

export function getRootTsConfigFileName(tree?: Tree): string | null {
  for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
    const pathExists = tree
      ? tree.exists(tsConfigName)
      : existsSync(join(workspaceRoot, tsConfigName));

    if (pathExists) {
      return tsConfigName;
    }
  }

  return null;
}

export function addTsConfigPath(
  tree: Tree,
  importPath: string,
  lookupPaths: string[]
) {
  updateJson(tree, getRootTsConfigPathInTree(tree), (json) => {
    json.compilerOptions ??= {};
    const c = json.compilerOptions;
    c.paths ??= {};

    if (c.paths[importPath]) {
      throw new Error(
        `You already have a library using the import path "${importPath}". Make sure to specify a unique one.`
      );
    }

    c.paths[importPath] = lookupPaths;

    return json;
  });
}

export function readTsConfigPaths(tsConfig?: string | ts.ParsedCommandLine) {
  tsConfig ??= getRootTsConfigPath();
  try {
    if (!tsModule) {
      tsModule = ensureTypescript();
    }

    let config: ts.ParsedCommandLine;

    if (typeof tsConfig === 'string') {
      const configFile = tsModule.readConfigFile(
        tsConfig,
        tsModule.sys.readFile
      );
      config = tsModule.parseJsonConfigFileContent(
        configFile.config,
        tsModule.sys,
        dirname(tsConfig)
      );
    } else {
      config = tsConfig;
    }
    if (config.options?.paths) {
      return config.options.paths;
    } else {
      return null;
    }
  } catch (e) {
    return null;
  }
}
