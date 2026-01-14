import type { SourceFile } from 'typescript';

export function getModuleMetadataFromAST(
  componentAST: SourceFile,
  componentFileContents: string
) {
  const NGMODULE_CONTENT_SELECTOR =
    'ClassDeclaration:has(Decorator > CallExpression:has(Identifier[name=NgModule]))';
  const { ast, query } = require('@phenomnomnominal/tsquery');
  const moduleNodes = query(componentAST, NGMODULE_CONTENT_SELECTOR);
  const moduleContents = componentFileContents.slice(
    moduleNodes[0].getStart(),
    moduleNodes[0].getEnd()
  );

  // verify module is a scam
  const NGMODULE_EXPORTS_SELECTOR =
    'ClassDeclaration > Decorator > CallExpression:has(Identifier[name=NgModule]) ObjectLiteralExpression > PropertyAssignment:has(Identifier[name=exports]) ArrayLiteralExpression';
  const NGMODULE_DECLARATIONS_SELECTOR =
    'ClassDeclaration > Decorator > CallExpression:has(Identifier[name=NgModule]) ObjectLiteralExpression > PropertyAssignment:has(Identifier[name=declarations]) ArrayLiteralExpression';
  const NGMODULE_IMPORTS_SELECTOR =
    'ClassDeclaration > Decorator > CallExpression:has(Identifier[name=NgModule]) ObjectLiteralExpression > PropertyAssignment:has(Identifier[name=imports]) ArrayLiteralExpression';
  const NGMODULE_PROVIDERS_SELECTOR =
    'ClassDeclaration > Decorator > CallExpression:has(Identifier[name=NgModule]) ObjectLiteralExpression > PropertyAssignment:has(Identifier[name=providers]) ArrayLiteralExpression';
  const NGMODULE_NAME_SELECTOR =
    'ClassDeclaration:has(Decorator > CallExpression:has(Identifier[name=NgModule])) > Identifier';

  const moduleAST = ast(moduleContents);
  const importsNode = query(moduleAST, NGMODULE_IMPORTS_SELECTOR)[0];
  const exportsNode = query(moduleAST, NGMODULE_EXPORTS_SELECTOR)[0];
  const declarationsNode = query(moduleAST, NGMODULE_DECLARATIONS_SELECTOR)[0];
  const providersNodes = query(moduleAST, NGMODULE_PROVIDERS_SELECTOR);

  const exportsArray = moduleContents
    .slice(exportsNode.getStart(), exportsNode.getEnd())
    .replace('[', '')
    .replace(']', '')
    .split(',');
  const importsArray = moduleContents
    .slice(importsNode.getStart(), importsNode.getEnd())
    .replace('[', '')
    .replace(']', '')
    .split(',');
  const declarationsArray = moduleContents
    .slice(declarationsNode.getStart(), declarationsNode.getEnd())
    .replace('[', '')
    .replace(']', '')
    .split(',');
  const providersArray =
    providersNodes.length > 0
      ? moduleContents
          .slice(providersNodes[0].getStart(), providersNodes[0].getEnd())
          .replace('[', '')
          .replace(']', '')
          .split(',')
      : [];
  const moduleName = query(moduleAST, NGMODULE_NAME_SELECTOR)[0].getText();
  return {
    moduleNodes,
    exportsArray,
    importsArray,
    declarationsArray,
    providersArray,
    moduleName,
  };
}
