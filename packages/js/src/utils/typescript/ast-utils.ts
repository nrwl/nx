import type { Tree } from '@nx/devkit';
import type * as ts from 'typescript';
// TODO(colum): replace when https://github.com/nrwl/nx/pull/15497 is merged
import { getSourceNodes } from '@nx/workspace/src/utilities/typescript';
import { ensureTypescript } from './ensure-typescript';
import { Node, SyntaxKind } from 'typescript';
import { workspaceRoot } from '@nx/devkit';
import { dirname } from 'path';

const normalizedAppRoot = workspaceRoot.replace(/\\/g, '/');

let tsModule: typeof import('typescript');

let compilerHost: {
  host: ts.CompilerHost;
  options: ts.CompilerOptions;
  moduleResolutionCache: ts.ModuleResolutionCache;
};

/**
 * Find a module based on its import
 *
 * @param importExpr Import used to resolve to a module
 * @param filePath
 * @param tsConfigPath
 */
export function resolveModuleByImport(
  importExpr: string,
  filePath: string,
  tsConfigPath: string
) {
  compilerHost = compilerHost || getCompilerHost(tsConfigPath);
  const { options, host, moduleResolutionCache } = compilerHost;

  const { resolvedModule } = tsModule.resolveModuleName(
    importExpr,
    filePath,
    options,
    host,
    moduleResolutionCache
  );

  if (!resolvedModule) {
    return;
  } else {
    return resolvedModule.resolvedFileName.replace(`${normalizedAppRoot}/`, '');
  }
}

function getCompilerHost(tsConfigPath: string) {
  const options = readTsConfigOptions(tsConfigPath);
  const host = tsModule.createCompilerHost(options, true);
  const moduleResolutionCache = tsModule.createModuleResolutionCache(
    workspaceRoot,
    host.getCanonicalFileName
  );
  return { options, host, moduleResolutionCache };
}

function readTsConfigOptions(tsConfigPath: string) {
  if (!tsModule) {
    tsModule = require('typescript');
  }

  const readResult = tsModule.readConfigFile(
    tsConfigPath,
    tsModule.sys.readFile
  );

  // we don't need to scan the files, we only care about options
  const host: Partial<ts.ParseConfigHost> = {
    readDirectory: () => [],
    readFile: () => '',
    fileExists: tsModule.sys.fileExists,
  };

  return tsModule.parseJsonConfigFileContent(
    readResult.config,
    host as ts.ParseConfigHost,
    dirname(tsConfigPath)
  ).options;
}

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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const rootNode = source;
  const allImports = findNodes(rootNode, tsModule.SyntaxKind.ImportDeclaration);

  // get nodes that map to import statements from the file fileName
  const relevantImports = allImports.filter((node) => {
    // StringLiteral of the ImportDeclaration is the import file (fileName in this case).
    const importFiles = node
      .getChildren()
      .filter((child) => child.kind === tsModule.SyntaxKind.StringLiteral)
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
        findNodes(n, tsModule.SyntaxKind.Identifier)
      );
      if (findNodes(n, tsModule.SyntaxKind.AsteriskToken).length > 0) {
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
          tsModule.SyntaxKind.CloseBraceToken
        )[0].getStart() ||
        findNodes(
          relevantImports[0],
          tsModule.SyntaxKind.FromKeyword
        )[0].getStart();

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
  const useStrict = findNodes(
    rootNode,
    tsModule.SyntaxKind.StringLiteral
  ).filter((n: ts.StringLiteral) => n.text === 'use strict');
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
    tsModule.SyntaxKind.StringLiteral
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const allImports = findNodes(source, tsModule.SyntaxKind.ImportDeclaration);
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const allImports = findNodes(source, tsModule.SyntaxKind.ImportDeclaration);
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

export function addParameterToConstructor(
  tree: Tree,
  source: ts.SourceFile,
  modulePath: string,
  opts: { className: string; param: string }
): ts.SourceFile {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const clazz = findClass(source, opts.className);
  const constructor = clazz.members.filter(
    (m) => m.kind === tsModule.SyntaxKind.Constructor
  )[0];

  if (constructor) {
    throw new Error('Should be tested'); // TODO: check this
  }

  return addMethod(tree, source, modulePath, {
    className: opts.className,
    methodHeader: `constructor(${opts.param})`,
  });
}

export function addMethod(
  tree: Tree,
  source: ts.SourceFile,
  modulePath: string,
  opts: { className: string; methodHeader: string; body?: string }
): ts.SourceFile {
  const clazz = findClass(source, opts.className);
  const body = opts.body
    ? `
${opts.methodHeader} {
${opts.body}
}
`
    : `
${opts.methodHeader} {}
`;

  return insertChange(tree, source, modulePath, clazz.end - 1, body);
}

export function findClass(
  source: ts.SourceFile,
  className: string,
  silent: boolean = false
): ts.ClassDeclaration {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const nodes = getSourceNodes(source);

  const clazz = nodes.filter(
    (n) =>
      n.kind === tsModule.SyntaxKind.ClassDeclaration &&
      (<any>n).name.text === className
  )[0] as ts.ClassDeclaration;

  if (!clazz && !silent) {
    throw new Error(`Cannot find class '${className}'.`);
  }

  return clazz;
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
