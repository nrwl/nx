import { joinPathFragments, readJsonFile } from '@nrwl/devkit';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript';
import { MappedProjectGraphNode } from '@nrwl/workspace/src/utils/runtime-lint-utils';
import { existsSync, readFileSync } from 'fs';
import { dirname } from 'path';
import ts = require('typescript');
import { logger } from '@nrwl/devkit';
import { appRootPath } from 'nx/src/utils/app-root';

function tryReadBaseJson() {
  try {
    return readJsonFile(joinPathFragments(appRootPath, 'tsconfig.base.json'));
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
): string[] | null {
  const tsConfigBase = tryReadBaseJson();
  return tsConfigBase?.compilerOptions?.paths[importScope] || null;
}

export function getBarrelEntryPointProjectNode(
  importScope: MappedProjectGraphNode<any>
): { path: string; importScope: string }[] | null {
  const tsConfigBase = tryReadBaseJson();

  if (tsConfigBase?.compilerOptions?.paths) {
    const potentialEntryPoints = Object.keys(tsConfigBase.compilerOptions.paths)
      .filter((entry) => {
        const sourceFolderPaths = tsConfigBase.compilerOptions.paths[entry];
        return sourceFolderPaths.some((sourceFolderPath) => {
          return sourceFolderPath.includes(importScope.data.root);
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
            parent.modifiers &&
            parent.modifiers.find(
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

      let moduleFilePath = joinPathFragments(
        './',
        dirname(filePath),
        `${modulePath}.ts`
      );
      if (!existsSync(moduleFilePath)) {
        // might be a index.ts
        moduleFilePath = joinPathFragments(
          './',
          dirname(filePath),
          `${modulePath}/index.ts`
        );
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
