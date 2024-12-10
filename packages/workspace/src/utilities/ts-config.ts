import { offsetFromRoot, Tree, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import type { CompilerOptions, Node, SyntaxKind } from 'typescript';
import { ensureTypescript } from './typescript';

let tsModule: typeof import('typescript');

const TSCONFIG_FILE_NAMES = ['tsconfig.base.json', 'tsconfig.json'] as const;
export type TSConfigFileName = (typeof TSCONFIG_FILE_NAMES)[number];

export type TSConfig = {
  compilerOptions: CompilerOptions;
  [string: string]: unknown;
};

export function readTsConfig(tsConfigPath: string) {
  if (!tsModule) {
    tsModule = ensureTypescript();
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
export function getRootTsConfigPathInTree(tree: Tree): TSConfigFileName | null {
  for (const path of TSCONFIG_FILE_NAMES) {
    if (tree.exists(path)) {
      return path;
    }
  }

  return null;
}

export function getRelativePathToRootTsConfig(
  tree: Tree,
  targetPath: string
): string {
  return offsetFromRoot(targetPath) + getRootTsConfigPathInTree(tree);
}

export function getRootTsConfigFileName(): TSConfigFileName | null {
  for (const tsConfigName of TSCONFIG_FILE_NAMES) {
    const tsConfigPath = join(workspaceRoot, tsConfigName);
    if (existsSync(tsConfigPath)) {
      return tsConfigName;
    }
  }

  return null;
}

export function findNodes(
  node: Node,
  kind: SyntaxKind | SyntaxKind[],
  max = Infinity
): Node[] {
  if (!node || max == 0) {
    return [];
  }

  const arr: Node[] = [];
  const hasMatch = Array.isArray(kind)
    ? kind.includes(node.kind)
    : node.kind === kind;
  if (hasMatch) {
    arr.push(node);
    max--;
  }
  if (max > 0) {
    for (const child of node.getChildren()) {
      findNodes(child, kind, max).forEach((node) => {
        if (max > 0) {
          arr.push(node);
        }
        max--;
      });

      if (max <= 0) {
        break;
      }
    }
  }

  return arr;
}
