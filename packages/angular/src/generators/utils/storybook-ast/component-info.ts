import {
  joinPathFragments,
  logger,
  normalizePath,
  Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { basename, dirname, extname, relative } from 'path';
import type { Identifier, SourceFile, Statement } from 'typescript';
import { getTsSourceFile } from '../../../utils/nx-devkit/ast-utils';
import { getInstalledAngularVersionInfo } from '../version-utils';
import type { EntryPoint } from './entry-point';
import { getModuleDeclarations } from './module-info';

let tsModule: typeof import('typescript');
let tsquery: typeof import('@phenomnomnominal/tsquery').tsquery;

export interface ComponentInfo {
  componentFileName: string;
  moduleFolderPath: string;
  name: string;
  path: string;
  entryPointName: string;
}

export function getComponentsInfo(
  tree: Tree,
  entryPoint: EntryPoint,
  moduleFilePaths: string[],
  projectName: string
): ComponentInfo[] {
  return moduleFilePaths
    .flatMap((moduleFilePath) => {
      const file = getTsSourceFile(tree, moduleFilePath);
      const moduleDeclarations = getModuleDeclarations(
        file,
        moduleFilePath,
        projectName
      );
      if (moduleDeclarations.length === 0) {
        return undefined;
      }

      if (!tsModule) {
        tsModule = ensureTypescript();
      }
      const imports = file.statements.filter(
        (statement) => statement.kind === tsModule.SyntaxKind.ImportDeclaration
      );

      const componentsInfo = moduleDeclarations.map((maybeComponentName) =>
        tryGetComponentInfo(
          tree,
          entryPoint,
          file,
          imports,
          moduleFilePath,
          maybeComponentName
        )
      );

      return componentsInfo;
    })
    .filter((f) => f !== undefined);
}

export function getStandaloneComponentsInfo(
  tree: Tree,
  entryPoint: EntryPoint
): ComponentInfo[] {
  const componentsInfo: ComponentInfo[] = [];

  visitNotIgnoredFiles(tree, entryPoint.path, (filePath: string) => {
    const normalizedFilePath = normalizePath(filePath);

    if (
      entryPoint.excludeDirs?.some((excludeDir) =>
        normalizedFilePath.startsWith(excludeDir)
      )
    ) {
      return;
    }

    if (
      extname(normalizedFilePath) !== '.ts' ||
      normalizedFilePath.includes('.storybook')
    ) {
      return;
    }

    const standaloneComponents = getStandaloneComponents(
      tree,
      normalizedFilePath
    );
    if (!standaloneComponents.length) {
      return;
    }

    standaloneComponents.forEach((componentName) => {
      componentsInfo.push({
        componentFileName: basename(normalizedFilePath, '.ts'),
        moduleFolderPath: entryPoint.path,
        name: componentName,
        path: dirname(relative(entryPoint.path, normalizedFilePath)),
        entryPointName: entryPoint.name,
      });
    });
  });

  return componentsInfo;
}

function getStandaloneComponents(tree: Tree, filePath: string): string[] {
  if (!tsquery) {
    ensureTypescript();
    tsquery = require('@phenomnomnominal/tsquery').tsquery;
  }
  const fileContent = tree.read(filePath, 'utf-8');
  const ast = tsquery.ast(fileContent);

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  if (angularMajorVersion < 19) {
    // in angular 18 and below, standalone: false is the default, so only
    // components with standalone: true are considered standalone
    const components = tsquery<Identifier>(
      ast,
      'ClassDeclaration:has(Decorator > CallExpression:has(Identifier[name=Component]) ObjectLiteralExpression PropertyAssignment:has(Identifier[name=standalone]) > TrueKeyword) > Identifier',
      { visitAllChildren: true }
    );

    return components.map((component) => component.getText());
  }

  // in angular 19 and above, standalone: true is the default, so all components
  // except those with standalone: false are considered standalone
  const standaloneComponentNodes = tsquery<Identifier>(
    ast,
    'ClassDeclaration:has(Decorator > CallExpression:has(Identifier[name=Component]) ObjectLiteralExpression:not(:has(PropertyAssignment:has(Identifier[name=standalone]) > FalseKeyword))) > Identifier',
    { visitAllChildren: true }
  );

  return standaloneComponentNodes.map((component) => component.getText());
}

function getComponentImportPath(
  componentName: string,
  imports: Statement[]
): string {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const componentImportStatement = imports.find((statement) => {
    const namedImports = statement
      .getChildren()
      .find((node) => node.kind === tsModule.SyntaxKind.ImportClause)
      .getChildren()
      .find((node) => node.kind === tsModule.SyntaxKind.NamedImports);

    if (namedImports === undefined) return false;

    const importedIdentifiers = namedImports
      .getChildren()
      .find((node) => node.kind === tsModule.SyntaxKind.SyntaxList)
      .getChildren()
      .filter((node) => node.kind === tsModule.SyntaxKind.ImportSpecifier)
      .map((node) => node.getText());

    return importedIdentifiers.includes(componentName);
  });

  const importPath = componentImportStatement
    .getChildren()
    .find((node) => node.kind === tsModule.SyntaxKind.StringLiteral)
    .getText()
    .slice(1, -1);

  return importPath;
}

function tryGetComponentInfo(
  tree: Tree,
  entryPoint: EntryPoint,
  sourceFile: SourceFile,
  imports: Statement[],
  moduleFilePath: string,
  symbolName: string
): ComponentInfo | undefined {
  try {
    if (!tsquery) {
      ensureTypescript();
      tsquery = require('@phenomnomnominal/tsquery').tsquery;
    }

    const moduleFolderPath = dirname(moduleFilePath);

    // try to get the component from the same file (inline scam)
    const node = tsquery(
      sourceFile,
      `ClassDeclaration:has(Decorator > CallExpression > Identifier[name=Component]):has(Identifier[name=${symbolName}])`,
      { visitAllChildren: true }
    )[0];

    if (node) {
      return {
        componentFileName: basename(moduleFilePath, '.ts'),
        moduleFolderPath,
        name: symbolName,
        path: '.',
        entryPointName: entryPoint.name,
      };
    }

    // try to get the component from the imports
    const symbolFilePathRelativeToModule = getComponentImportPath(
      symbolName,
      imports
    );
    let symbolImportPath = getFullComponentFilePath(
      moduleFolderPath,
      symbolFilePathRelativeToModule
    );

    if (tree.exists(symbolImportPath) && !tree.isFile(symbolImportPath)) {
      return tryGetComponentInfoFromDir(
        tree,
        entryPoint,
        symbolImportPath,
        symbolName,
        moduleFolderPath
      );
    }

    const candidatePaths = [
      symbolImportPath,
      `${symbolImportPath}.ts`,
      `${symbolImportPath}.js`,
    ];

    for (const candidatePath of candidatePaths) {
      if (!tree.exists(candidatePath)) {
        continue;
      }

      const content = tree.read(candidatePath, 'utf-8');
      const classAndComponentRegex = new RegExp(
        `@Component[\\s\\S\n]*?\\bclass ${symbolName}\\b`,
        'g'
      );

      if (content.match(classAndComponentRegex)) {
        const path = dirname(symbolFilePathRelativeToModule);
        const componentFileName = basename(symbolFilePathRelativeToModule);

        return {
          componentFileName,
          moduleFolderPath,
          name: symbolName,
          path,
          entryPointName: entryPoint.name,
        };
      }
    }

    return undefined;
  } catch (ex) {
    logger.warn(`Could not generate a story for ${symbolName}. Error: ${ex}`);
    return undefined;
  }
}

function tryGetComponentInfoFromDir(
  tree: Tree,
  entryPoint: EntryPoint,
  dir: string,
  symbolName: string,
  moduleFolderPath: string
): ComponentInfo | undefined {
  let path = null;
  let componentFileName = null;

  const componentImportPathChildren: string[] = [];
  visitNotIgnoredFiles(tree, dir, (filePath) => {
    componentImportPathChildren.push(normalizePath(filePath));
  });

  for (const candidateFile of componentImportPathChildren) {
    if (candidateFile.endsWith('.ts')) {
      const content = tree.read(candidateFile, 'utf-8');
      const classAndComponentRegex = new RegExp(
        `@Component[\\s\\S\n]*?\\bclass ${symbolName}\\b`,
        'g'
      );
      if (content.match(classAndComponentRegex)) {
        path = candidateFile
          .slice(0, candidateFile.lastIndexOf('/'))
          .replace(moduleFolderPath, '.');
        componentFileName = candidateFile.slice(
          candidateFile.lastIndexOf('/') + 1,
          candidateFile.lastIndexOf('.')
        );
        break;
      }
    }
  }

  if (path === null) {
    console.warn(
      `Couldn't resolve "${symbolName}" imported from ${dir} relative to ${moduleFolderPath}.`
    );
    return undefined;
  }

  return {
    componentFileName,
    moduleFolderPath,
    name: symbolName,
    path,
    entryPointName: entryPoint.name,
  };
}

function getFullComponentFilePath(
  moduleFolderPath: string,
  componentFilePath: string
): string {
  if (moduleFolderPath.startsWith('/')) {
    moduleFolderPath = moduleFolderPath.slice(1, moduleFolderPath.length);
  }

  return joinPathFragments(moduleFolderPath, componentFilePath);
}
