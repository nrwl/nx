import {
  logger,
  ProjectGraphProjectNode,
  readJsonFile,
  workspaceRoot,
} from '@nx/devkit';
import { findNodes } from '@nx/js';
import { getModifiers } from '@typescript-eslint/type-utils';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import ts = require('typescript');

function tryReadBaseJson() {
  try {
    return readJsonFile(join(workspaceRoot, 'tsconfig.base.json'));
  } catch (e) {
    logger.warn(`Error reading "tsconfig.base.json": \n${JSON.stringify(e)}`);
    return null;
  }
}

/**
 *
 * @param importScope like `@myorg/somelib`
 * @returns
 */
export function getBarrelEntryPointByImportScope(
  importScope: string
): string[] {
  const tryPaths = (
    paths: Record<string, string[]>,
    importScope: string
  ): string[] => {
    // TODO check and warn that the entries of paths[importScope] have no wildcards; that'd be user misconfiguration
    if (paths[importScope]) return paths[importScope];

    // accommodate wildcards (it's not glob) https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping
    const result = new Set<string>(); // set ensures there are no duplicates

    for (const [alias, targets] of Object.entries(paths)) {
      if (!alias.endsWith('*')) {
        continue;
      }
      const strippedAlias = alias.slice(0, -1); // remove asterisk
      if (!importScope.startsWith(strippedAlias)) {
        continue;
      }
      const dynamicPart = importScope.slice(strippedAlias.length);
      targets.forEach((target) => {
        result.add(target.replace('*', dynamicPart)); // add interpolated value
      });
      // we found the entry for importScope; an import scope not supposed and has no sense having > 1 Aliases; TODO warn on duplicated entries
      break;
    }

    return Array.from(result);
  };
  const tsConfigBase = tryReadBaseJson();
  if (!tsConfigBase?.compilerOptions?.paths) return [];
  return tryPaths(tsConfigBase.compilerOptions.paths, importScope);
}

export function getBarrelEntryPointProjectNode(
  projectNode: ProjectGraphProjectNode
): { path: string; importScope: string }[] | null {
  const tsConfigBase = tryReadBaseJson();

  if (tsConfigBase?.compilerOptions?.paths) {
    const potentialEntryPoints = Object.keys(tsConfigBase.compilerOptions.paths)
      .filter((entry) => {
        const sourceFolderPaths = tsConfigBase.compilerOptions.paths[entry];
        return sourceFolderPaths.some((sourceFolderPath) => {
          return (
            sourceFolderPath === projectNode.data.sourceRoot ||
            sourceFolderPath.indexOf(`${projectNode.data.sourceRoot}/`) === 0
          );
        });
      })
      .map((entry) =>
        tsConfigBase.compilerOptions.paths[entry].map((x) => ({
          path: x,
          importScope: entry,
        }))
      );

    return potentialEntryPoints.flat();
  }

  return null;
}

function hasMemberExport(exportedMember, filePath) {
  const fileContent = readFileSync(filePath, 'utf8');

  // use the TypeScript AST to find the path to the file where exportedMember is defined
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  // search whether there is already an export with our node
  return (
    findNodes(sourceFile, ts.SyntaxKind.Identifier).filter(
      (identifier: any) => identifier.text === exportedMember
    ).length > 0
  );
}

export function getRelativeImportPath(exportedMember, filePath, basePath) {
  const status = lstatSync(filePath, {
    throwIfNoEntry: false,
  });
  if (!status /*not existed, but probably not full file with an extension*/) {
    // try to find an extension that exists
    const ext = ['.ts', '.tsx', '.js', '.jsx'].find((ext) =>
      lstatSync(filePath + ext, { throwIfNoEntry: false })
    );
    if (ext) {
      filePath += ext;
    }
  } else if (status.isDirectory()) {
    const file = readdirSync(filePath).find((file) =>
      /^index\.[jt]sx?$/.exec(file)
    );
    if (file) {
      filePath = join(filePath, file);
    } else {
      return;
    }
  }

  const fileContent = readFileSync(filePath, 'utf8');

  // use the TypeScript AST to find the path to the file where exportedMember is defined
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  // Search in the current file whether there's an export already!
  const memberNodes = findNodes(sourceFile, ts.SyntaxKind.Identifier).filter(
    (identifier: any) => identifier.text === exportedMember
  );

  let hasExport = false;
  for (const memberNode of memberNodes || []) {
    if (memberNode) {
      // recursively navigate upwards to find the ExportKey modifier
      let parent = memberNode;
      do {
        parent = parent.parent;
        if (parent) {
          // if we are inside a parameter list or decorator or param assignment
          // then this is not what we're searching for, so break :)
          if (
            parent.kind === ts.SyntaxKind.Parameter ||
            parent.kind === ts.SyntaxKind.PropertyAccessExpression ||
            parent.kind === ts.SyntaxKind.TypeReference ||
            parent.kind === ts.SyntaxKind.HeritageClause ||
            parent.kind === ts.SyntaxKind.Decorator
          ) {
            hasExport = false;
            break;
          }

          // if our identifier is within an ExportDeclaration but is not just
          // a re-export of some other module, we're good
          if (
            parent.kind === ts.SyntaxKind.ExportDeclaration &&
            !(parent as any).moduleSpecifier
          ) {
            hasExport = true;
            break;
          }

          if (
            getModifiers(parent)?.find(
              (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
            )
          ) {
            /**
             * if we get to a function export declaration we need to verify whether the
             * exported function is actually the member we are searching for. Otherwise
             * we might end up finding a function that just uses our searched identifier
             * internally.
             *
             * Example: assume we try to find a constant member: `export const SOME_CONSTANT = 'bla'`
             *
             * Then we might end up in a file that uses it like
             *
             * import { SOME_CONSTANT } from '@myorg/samelib'
             *
             * export function someFunction() {
             *  return `Hi, ${SOME_CONSTANT}`
             * }
             *
             * We want to avoid accidentally picking the someFunction export since we're searching upwards
             * starting from `SOME_CONSTANT` identifier usages.
             */
            if (parent.kind === ts.SyntaxKind.FunctionDeclaration) {
              const parentName = (parent as any).name?.text;
              if (parentName === exportedMember) {
                hasExport = true;
                break;
              }
            } else {
              hasExport = true;
              break;
            }
          }
        }
      } while (!!parent);
    }

    if (hasExport) {
      break;
    }
  }

  if (hasExport) {
    // we found the file, now grab the path
    return filePath;
  }

  // if we didn't find an export, let's try to follow
  // all export declarations and see whether any of those
  // exports the node we're searching for
  const exportDeclarations = findNodes(
    sourceFile,
    ts.SyntaxKind.ExportDeclaration
  ) as ts.ExportDeclaration[];
  for (const exportDeclaration of exportDeclarations) {
    if ((exportDeclaration as any).moduleSpecifier) {
      // verify whether the export declaration we're looking at is a named export
      // cause in that case we need to check whether our searched member is
      // part of the exports
      if (
        exportDeclaration.exportClause &&
        findNodes(exportDeclaration, ts.SyntaxKind.Identifier).filter(
          (identifier: any) => identifier.text === exportedMember
        ).length === 0
      ) {
        continue;
      }

      const modulePath = (exportDeclaration as any).moduleSpecifier.text;

      let moduleFilePath;
      if (modulePath.endsWith('.js') || modulePath.endsWith('.jsx')) {
        moduleFilePath = join(dirname(filePath), modulePath);
        if (!existsSync(moduleFilePath)) {
          const tsifiedModulePath = modulePath.replace(/\.js(x?)$/, '.ts$1');
          moduleFilePath = join(dirname(filePath), `${tsifiedModulePath}`);
        }
      } else if (modulePath.endsWith('.ts') || modulePath.endsWith('.tsx')) {
        moduleFilePath = join(dirname(filePath), modulePath);
      } else {
        moduleFilePath = join(dirname(filePath), `${modulePath}.ts`);
        if (!existsSync(moduleFilePath)) {
          // might be a tsx file
          moduleFilePath = join(dirname(filePath), `${modulePath}.tsx`);
        }
      }
      if (!existsSync(moduleFilePath)) {
        // might be an index.ts
        moduleFilePath = join(dirname(filePath), `${modulePath}/index.ts`);
      }

      if (hasMemberExport(exportedMember, moduleFilePath)) {
        const foundFilePath = getRelativeImportPath(
          exportedMember,
          moduleFilePath,
          basePath
        );
        if (foundFilePath) {
          return foundFilePath;
        }
      }
    }
  }

  return null;
}
