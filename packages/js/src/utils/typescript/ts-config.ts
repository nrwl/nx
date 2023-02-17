import {
  joinPathFragments,
  offsetFromRoot,
  Tree,
  updateJson,
  workspaceRoot,
} from '@nrwl/devkit';
import { existsSync } from 'fs';
import { dirname, join } from 'path';

let tsModule: typeof import('typescript');

export function readTsConfig(tsConfigPath: string) {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  const readResult = tsModule.readConfigFile(
    tsConfigPath,
    tsModule.sys.readFile
  );
  return tsModule.parseJsonConfigFileContent(
    readResult.config,
    tsModule.sys,
    dirname(tsConfigPath)
  );
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

export function getRootTsConfigFileName(tree: Tree): string | null {
  for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
    if (tree.exists(tsConfigName)) {
      return tsConfigName;
    }
  }

  return null;
}

export function updateRootTsConfig(
  host: Tree,
  options: {
    name: string;
    importPath?: string;
    projectRoot: string;
    js?: boolean;
  }
) {
  if (!options.importPath) {
    throw new Error(
      `Unable to update ${options.name} using the import path "${options.importPath}". Make sure to specify a valid import path one.`
    );
  }
  updateJson(host, getRootTsConfigPathInTree(host), (json) => {
    const c = json.compilerOptions;
    c.paths = c.paths || {};
    delete c.paths[options.name];

    if (c.paths[options.importPath]) {
      throw new Error(
        `You already have a library using the import path "${options.importPath}". Make sure to specify a unique one.`
      );
    }

    c.paths[options.importPath] = [
      joinPathFragments(
        options.projectRoot,
        './src',
        'index.' + (options.js ? 'js' : 'ts')
      ),
    ];

    return json;
  });
}
