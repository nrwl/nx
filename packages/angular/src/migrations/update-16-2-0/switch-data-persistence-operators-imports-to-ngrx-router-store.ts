import type { FileData, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  readJson,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import type { ImportDeclaration, ImportSpecifier, Node } from 'typescript';
import { FileChangeRecorder } from '../../utils/file-change-recorder';
import { ngrxVersion } from '../../utils/versions';
import { getProjectsFilteredByDependencies } from '../utils/projects';
import { readProjectFileMapCache } from 'nx/src/project-graph/nx-deps-cache';
import { fileDataDepTarget } from 'nx/src/config/project-graph';

let tsquery: typeof import('@phenomnomnominal/tsquery').tsquery;

const angularPluginTargetNames = ['npm:@nx/angular', 'npm:@nrwl/angular'];
const dataPersistenceOperators = [
  'fetch',
  'navigation',
  'optimisticUpdate',
  'pessimisticUpdate',
];
const newImportPath = '@ngrx/router-store/data-persistence';

export default async function (tree: Tree): Promise<void> {
  const projects = await getProjectsFilteredByDependencies(
    tree,
    angularPluginTargetNames
  );

  if (!projects.length) {
    return;
  }

  ensureTypescript();
  tsquery = require('@phenomnomnominal/tsquery').tsquery;
  const cachedFileMap = readProjectFileMapCache().projectFileMap;

  const filesWithNxAngularImports: FileData[] = [];
  for (const { graphNode } of projects) {
    const files = filterFilesWithNxAngularDep(
      cachedFileMap[graphNode.name] || []
    );
    filesWithNxAngularImports.push(...files);
  }

  let isAnyFileUsingDataPersistence = false;
  for (const { file } of filesWithNxAngularImports) {
    const updated = replaceDataPersistenceInFile(tree, file);
    isAnyFileUsingDataPersistence ||= updated;
  }

  if (isAnyFileUsingDataPersistence) {
    addNgrxRouterStoreIfNotInstalled(tree);

    await formatFiles(tree);
  }
}

function replaceDataPersistenceInFile(tree: Tree, file: string): boolean {
  const fileContents = tree.read(file, 'utf-8');
  const fileAst = tsquery.ast(fileContents);

  // "\\u002F" is the unicode code for "/", there's an issue with the query parser
  // that prevents using "/" directly in regex queries
  // https://github.com/estools/esquery/issues/68#issuecomment-415597670
  const NX_ANGULAR_IMPORT_SELECTOR =
    'ImportDeclaration:has(StringLiteral[value=/@(nx|nrwl)\\u002Fangular$/])';
  const nxAngularImports = tsquery<ImportDeclaration>(
    fileAst,
    NX_ANGULAR_IMPORT_SELECTOR,
    { visitAllChildren: true }
  );

  if (!nxAngularImports.length) {
    return false;
  }

  const recorder = new FileChangeRecorder(tree, file);

  const IMPORT_SPECIFIERS_SELECTOR =
    'ImportClause NamedImports ImportSpecifier';
  for (const importDeclaration of nxAngularImports) {
    const importSpecifiers = tsquery<ImportSpecifier>(
      importDeclaration,
      IMPORT_SPECIFIERS_SELECTOR,
      { visitAllChildren: true }
    );

    if (!importSpecifiers.length) {
      continue;
    }

    // no imported symbol is a data persistence operator, skip
    if (importSpecifiers.every((i) => !isOperatorImport(i))) {
      continue;
    }

    // all imported symbols are data persistence operators, change import path
    if (importSpecifiers.every((i) => isOperatorImport(i))) {
      const IMPORT_PATH_SELECTOR = `${NX_ANGULAR_IMPORT_SELECTOR} > StringLiteral`;
      const importPathNode = tsquery(importDeclaration, IMPORT_PATH_SELECTOR, {
        visitAllChildren: true,
      });
      recorder.replace(importPathNode[0], `'${newImportPath}'`);

      continue;
    }

    // mixed imports, split data persistence operators to a separate import
    const operatorImportSpecifiers: string[] = [];
    for (const importSpecifier of importSpecifiers) {
      if (isOperatorImport(importSpecifier)) {
        operatorImportSpecifiers.push(importSpecifier.getText());
        recorder.remove(
          importSpecifier.getStart(),
          importSpecifier.getEnd() +
            (hasTrailingComma(recorder.originalContent, importSpecifier)
              ? 1
              : 0)
        );
      }
    }

    recorder.insertLeft(
      importDeclaration.getStart(),
      `import { ${operatorImportSpecifiers.join(
        ', '
      )} } from '${newImportPath}';`
    );
  }

  if (recorder.hasChanged()) {
    recorder.applyChanges();
    return true;
  }

  return false;
}

function hasTrailingComma(content: string, node: Node): boolean {
  return content[node.getEnd()] === ',';
}

function isOperatorImport(importSpecifier: ImportSpecifier): boolean {
  return dataPersistenceOperators.includes(
    getOriginalIdentifierTextFromImportSpecifier(importSpecifier)
  );
}

function getOriginalIdentifierTextFromImportSpecifier(
  importSpecifier: ImportSpecifier
): string {
  const children = importSpecifier.getChildren();
  if (!children.length) {
    return importSpecifier.getText();
  }

  return children[0].getText();
}

function addNgrxRouterStoreIfNotInstalled(tree: Tree): void {
  const { dependencies, devDependencies } = readJson(tree, 'package.json');
  if (
    dependencies?.['@ngrx/router-store'] ||
    devDependencies?.['@ngrx/router-store']
  ) {
    return;
  }

  addDependenciesToPackageJson(tree, { '@ngrx/router-store': ngrxVersion }, {});
}

function filterFilesWithNxAngularDep(files: FileData[]): FileData[] {
  const filteredFiles: FileData[] = [];

  for (const file of files) {
    if (
      file.deps?.some((dep) =>
        angularPluginTargetNames.includes(fileDataDepTarget(dep))
      )
    ) {
      filteredFiles.push(file);
    }
  }

  return filteredFiles;
}
