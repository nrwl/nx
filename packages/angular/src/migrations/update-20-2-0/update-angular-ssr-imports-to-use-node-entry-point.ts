import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import type * as ts from 'typescript';
import { ensureTypescript, type TypescriptAst } from '@nx/devkit/internal';
import { FileChangeRecorder } from '../../utils/file-change-recorder';
import { getProjectsFilteredByDependencies } from '../utils/projects';

let tsModule: TypescriptAst;

export default async function (tree: Tree) {
  tsModule ??= ensureTypescript();
  const projects = await getProjectsFilteredByDependencies([
    'npm:@angular/ssr',
  ]);

  for (const graphNode of projects) {
    visitNotIgnoredFiles(tree, graphNode.data.root, (path) => {
      if (!path.endsWith('.ts') || path.endsWith('.d.ts')) {
        return;
      }

      let content = tree.read(path, 'utf-8');
      if (
        !content.includes('CommonEngine') ||
        content.includes('@angular/ssr/node')
      ) {
        return;
      }

      let recorder: FileChangeRecorder | undefined;
      const sourceFile = tsModule.createSourceFile(
        path,
        content,
        tsModule.ScriptTarget.Latest,
        true
      );
      const allImportDeclarations = sourceFile.statements.filter(
        tsModule.isImportDeclaration
      );

      if (allImportDeclarations.length === 0) {
        return;
      }

      const ssrImports = allImportDeclarations.filter(
        (n) =>
          tsModule.isStringLiteral(n.moduleSpecifier) &&
          n.moduleSpecifier.text === '@angular/ssr'
      );

      for (const ssrImport of ssrImports) {
        const ssrNamedBinding = getNamedImports(ssrImport);
        if (ssrNamedBinding) {
          const isUsingOldEntryPoint = ssrNamedBinding.elements.some((e) =>
            e.name.text.startsWith('CommonEngine')
          );

          if (!isUsingOldEntryPoint) {
            continue;
          }

          recorder ??= new FileChangeRecorder(tree, path);
          recorder.insertRight(ssrImport.moduleSpecifier.getEnd() - 1, '/node');
        }
      }

      if (recorder) {
        recorder.applyChanges();
      }
    });
  }

  await formatFiles(tree);
}

function getNamedImports(
  importDeclaration: ts.ImportDeclaration | undefined
): ts.NamedImports | undefined {
  tsModule ??= ensureTypescript();
  const namedBindings = importDeclaration?.importClause?.namedBindings;
  if (namedBindings && tsModule.isNamedImports(namedBindings)) {
    return namedBindings;
  }

  return undefined;
}
