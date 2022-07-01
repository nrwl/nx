import type { Tree } from '@nrwl/devkit';
import { visitNotIgnoredFiles } from '@nrwl/devkit';
import { extname } from 'path';
import { tsquery } from '@phenomnomnominal/tsquery';
import { SourceFile } from 'typescript';

const NRWL_ANGULAR_MFE_STATIC_IMPORT_SELECTOR =
  'ImportDeclaration > StringLiteral[value="@nrwl/angular/mfe"]';

const NRWL_ANGULAR_MFE_DYNAMIC_IMPORT_SELECTOR =
  'CallExpression:has(ImportKeyword) > StringLiteral[value="@nrwl/angular/mfe"]';

const NRWL_ANGULAR_MFE_TYPES_SELECTOR =
  'ImportDeclaration:has(StringLiteral[value=@nrwl/angular/module-federation]) > ImportClause > NamedImports';

export function replaceNrwlAngularMfImport(fileContents: string) {
  let fileAst: SourceFile = tsquery.ast(fileContents);
  if (fileContents.includes('@nrwl/angular/mfe')) {
    // This file definitely contains the string, however, we're interested in whether it is an import
    const staticQueryResult = tsquery(
      fileAst,
      NRWL_ANGULAR_MFE_STATIC_IMPORT_SELECTOR,
      {
        visitAllChildren: true,
      }
    );

    if (staticQueryResult && staticQueryResult.length > 0) {
      fileContents = `${fileContents.slice(
        0,
        staticQueryResult[0].getStart()
      )}'@nrwl/angular/mf'${fileContents.slice(staticQueryResult[0].getEnd())}`;
    }

    fileAst = tsquery.ast(fileContents);

    const dynamicQueryResult = tsquery(
      fileAst,
      NRWL_ANGULAR_MFE_DYNAMIC_IMPORT_SELECTOR,
      {
        visitAllChildren: true,
      }
    );

    if (dynamicQueryResult && dynamicQueryResult.length > 0) {
      fileContents = `${fileContents.slice(
        0,
        dynamicQueryResult[0].getStart()
      )}'@nrwl/angular/mf'${fileContents.slice(
        dynamicQueryResult[0].getEnd()
      )}`;
    }
  }
  return fileContents;
}

export function replaceExportedMFETypes(fileContents: string) {
  const ast = tsquery.ast(fileContents);
  const queryResult = tsquery(ast, NRWL_ANGULAR_MFE_TYPES_SELECTOR, {
    visitAllChildren: true,
  });

  if (queryResult && queryResult.length > 0) {
    const TYPES_IMPORTED_FROM_NRWL_REGEX =
      /(MFERemotes|MFEConfig)+.*from+.+(@nrwl\/angular\/module-federation)+/g;
    if (TYPES_IMPORTED_FROM_NRWL_REGEX.test(fileContents)) {
      fileContents = fileContents.replace(/MFERemotes/g, 'MFRemotes');
      fileContents = fileContents.replace(/MFEConfig/g, 'MFConfig');
    }
  }
  return fileContents;
}

export function renameSetupMfeGeneratorUsages(fileContents: string) {
  // Attempt to update any custom generator usage of the changed generators
  const NRWL_SETUP_MFE_IMPORT_SELECTOR =
    'ImportDeclaration:has(StringLiteral[value=@nrwl/angular/generators]) > ImportClause:has(NamedImports:has(ImportSpecifier > Identifier[name=setupMfe]))';
  const SETUP_MFE_IMPORTED_FROM_NRWL_REGEX =
    /(setupMfe)+.*from+.+(@nrwl\/angular\/generators)+/g;
  const SETUP_MFE_FUNCTION_CALL_MFE_TYPE_PROPERTY_ASSIGNMENT_SELECTOR =
    'CallExpression:has(Identifier[name=setupMf]) ObjectLiteralExpression > PropertyAssignment > Identifier[name=mfeType]';

  let ast = tsquery.ast(fileContents);
  let queryResult = tsquery(ast, NRWL_SETUP_MFE_IMPORT_SELECTOR, {
    visitAllChildren: true,
  });
  if (
    queryResult &&
    queryResult.length > 0 &&
    SETUP_MFE_IMPORTED_FROM_NRWL_REGEX.test(fileContents)
  ) {
    fileContents = fileContents.replace(/setupMfe/g, 'setupMf');
  }

  ast = tsquery.ast(fileContents);

  queryResult = tsquery(
    ast,
    SETUP_MFE_FUNCTION_CALL_MFE_TYPE_PROPERTY_ASSIGNMENT_SELECTOR,
    {
      visitAllChildren: true,
    }
  );

  while (queryResult && queryResult.length > 0) {
    const node = queryResult[0];
    fileContents = `${fileContents.slice(
      0,
      node.getStart()
    )}mfType${fileContents.slice(node.getEnd())}`;

    ast = tsquery.ast(fileContents);

    queryResult = tsquery(
      ast,
      SETUP_MFE_FUNCTION_CALL_MFE_TYPE_PROPERTY_ASSIGNMENT_SELECTOR,
      {
        visitAllChildren: true,
      }
    );
  }

  return fileContents;
}

export default async function (tree: Tree) {
  visitNotIgnoredFiles(tree, '/', (path) => {
    const pathExtName = extname(path);

    let fileContents = tree.read(path, 'utf-8');
    if (pathExtName === '.ts' || pathExtName === '.js') {
      fileContents = replaceNrwlAngularMfImport(fileContents);
    }

    if (pathExtName === '.ts') {
      // Only TS files can import types and interfaces
      fileContents = replaceExportedMFETypes(fileContents);

      fileContents = renameSetupMfeGeneratorUsages(fileContents);
    }

    tree.write(path, fileContents);
  });
}
