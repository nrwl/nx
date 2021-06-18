import { getWorkspaceLayout, Tree } from '@nrwl/devkit';
import * as ts from 'typescript';
import { findNodes } from './typescript/find-nodes';

function nodesByPosition(first: ts.Node, second: ts.Node): number {
  return first.getStart() - second.getStart();
}

function updateTsSourceFile(
  host: Tree,
  sourceFile: ts.SourceFile,
  filePath: string
): ts.SourceFile {
  const newFileContents = host.read(filePath).toString('utf-8');
  return sourceFile.update(newFileContents, {
    newLength: newFileContents.length,
    span: {
      length: sourceFile.text.length,
      start: 0,
    },
  });
}

export function insertChange(
  host: Tree,
  sourceFile: ts.SourceFile,
  filePath: string,
  insertPosition: number,
  contentToInsert: string
): ts.SourceFile {
  const content = host.read(filePath).toString();
  const prefix = content.substring(0, insertPosition);
  const suffix = content.substring(insertPosition);

  host.write(filePath, `${prefix}${contentToInsert}${suffix}`);

  return updateTsSourceFile(host, sourceFile, filePath);
}

export function replaceChange(
  host: Tree,
  sourceFile: ts.SourceFile,
  filePath: string,
  insertPosition: number,
  contentToInsert: string,
  oldContent: string
) {
  const content = host.read(filePath, 'utf-8');

  const prefix = content.substring(0, insertPosition);
  const suffix = content.substring(insertPosition + oldContent.length);
  const text = content.substring(
    insertPosition,
    insertPosition + oldContent.length
  );
  if (text !== oldContent) {
    throw new Error(`Invalid replace: "${text}" != "${oldContent}".`);
  }

  host.write(filePath, `${prefix}${contentToInsert}${suffix}`);

  return updateTsSourceFile(host, sourceFile, filePath);
}

export function removeChange(
  host: Tree,
  sourceFile: ts.SourceFile,
  filePath: string,
  removePosition: number,
  contentToRemove: string
): ts.SourceFile {
  const content = host.read(filePath).toString();
  const prefix = content.substring(0, removePosition);
  const suffix = content.substring(removePosition + contentToRemove.length);
  host.write(filePath, `${prefix}${suffix}`);

  return updateTsSourceFile(host, sourceFile, filePath);
}

export function insertImport(
  host: Tree,
  source: ts.SourceFile,
  fileToEdit: string,
  symbolName: string,
  fileName: string,
  isDefault = false
): ts.SourceFile {
  const rootNode = source;
  const allImports = findNodes(rootNode, ts.SyntaxKind.ImportDeclaration);

  // get nodes that map to import statements from the file fileName
  const relevantImports = allImports.filter((node) => {
    // StringLiteral of the ImportDeclaration is the import file (fileName in this case).
    const importFiles = node
      .getChildren()
      .filter((child) => child.kind === ts.SyntaxKind.StringLiteral)
      .map((n) => (n as ts.StringLiteral).text);

    return importFiles.filter((file) => file === fileName).length === 1;
  });

  if (relevantImports.length > 0) {
    let importsAsterisk = false;
    // imports from import file
    const imports: ts.Node[] = [];
    relevantImports.forEach((n) => {
      Array.prototype.push.apply(
        imports,
        findNodes(n, ts.SyntaxKind.Identifier)
      );
      if (findNodes(n, ts.SyntaxKind.AsteriskToken).length > 0) {
        importsAsterisk = true;
      }
    });

    // if imports * from fileName, don't add symbolName
    if (importsAsterisk) {
      return source;
    }

    const importTextNodes = imports.filter(
      (n) => (n as ts.Identifier).text === symbolName
    );

    // insert import if it's not there
    if (importTextNodes.length === 0) {
      const fallbackPos =
        findNodes(
          relevantImports[0],
          ts.SyntaxKind.CloseBraceToken
        )[0].getStart() ||
        findNodes(relevantImports[0], ts.SyntaxKind.FromKeyword)[0].getStart();

      return insertAfterLastOccurrence(
        host,
        source,
        imports,
        `, ${symbolName}`,
        fileToEdit,
        fallbackPos
      );
    }

    return source;
  }

  // no such import declaration exists
  const useStrict = findNodes(rootNode, ts.SyntaxKind.StringLiteral).filter(
    (n: ts.StringLiteral) => n.text === 'use strict'
  );
  let fallbackPos = 0;
  if (useStrict.length > 0) {
    fallbackPos = useStrict[0].end;
  }
  const open = isDefault ? '' : '{ ';
  const close = isDefault ? '' : ' }';
  // if there are no imports or 'use strict' statement, insert import at beginning of file
  const insertAtBeginning = allImports.length === 0 && useStrict.length === 0;
  const separator = insertAtBeginning ? '' : ';\n';
  const toInsert =
    `${separator}import ${open}${symbolName}${close}` +
    ` from '${fileName}'${insertAtBeginning ? ';\n' : ''}`;

  return insertAfterLastOccurrence(
    host,
    source,
    allImports,
    toInsert,
    fileToEdit,
    fallbackPos,
    ts.SyntaxKind.StringLiteral
  );
}

function insertAfterLastOccurrence(
  host: Tree,
  sourceFile: ts.SourceFile,
  nodes: ts.Node[],
  toInsert: string,
  pathToFile: string,
  fallbackPos: number,
  syntaxKind?: ts.SyntaxKind
): ts.SourceFile {
  // sort() has a side effect, so make a copy so that we won't overwrite the parent's object.
  let lastItem = [...nodes].sort(nodesByPosition).pop();
  if (!lastItem) {
    throw new Error();
  }
  if (syntaxKind) {
    lastItem = findNodes(lastItem, syntaxKind).sort(nodesByPosition).pop();
  }
  if (!lastItem && fallbackPos == undefined) {
    throw new Error(
      `tried to insert ${toInsert} as first occurrence with no fallback position`
    );
  }
  const lastItemPosition: number = lastItem ? lastItem.getEnd() : fallbackPos;

  return insertChange(host, sourceFile, pathToFile, lastItemPosition, toInsert);
}

export function addGlobal(
  host: Tree,
  source: ts.SourceFile,
  modulePath: string,
  statement: string
): ts.SourceFile {
  const allImports = findNodes(source, ts.SyntaxKind.ImportDeclaration);
  if (allImports.length > 0) {
    const lastImport = allImports[allImports.length - 1];
    return insertChange(
      host,
      source,
      modulePath,
      lastImport.end + 1,
      `\n${statement}\n`
    );
  } else {
    return insertChange(host, source, modulePath, 0, `${statement}\n`);
  }
}

export function getImport(
  source: ts.SourceFile,
  predicate: (a: any) => boolean
): { moduleSpec: string; bindings: string[] }[] {
  const allImports = findNodes(source, ts.SyntaxKind.ImportDeclaration);
  const matching = allImports.filter((i: ts.ImportDeclaration) =>
    predicate(i.moduleSpecifier.getText())
  );

  return matching.map((i: ts.ImportDeclaration) => {
    const moduleSpec = i.moduleSpecifier
      .getText()
      .substring(1, i.moduleSpecifier.getText().length - 1);
    const t = i.importClause.namedBindings.getText();
    const bindings = t
      .replace('{', '')
      .replace('}', '')
      .split(',')
      .map((q) => q.trim());
    return { moduleSpec, bindings };
  });
}

export function replaceNodeValue(
  host: Tree,
  sourceFile: ts.SourceFile,
  modulePath: string,
  node: ts.Node,
  content: string
) {
  return replaceChange(
    host,
    sourceFile,
    modulePath,
    node.getStart(node.getSourceFile()),
    content,
    node.getText()
  );
}
