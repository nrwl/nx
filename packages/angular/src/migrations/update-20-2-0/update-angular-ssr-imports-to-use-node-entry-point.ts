import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { FileChangeRecorder } from '../../utils/file-change-recorder';
import { getProjectsFilteredByDependencies } from '../utils/projects';

export default async function (tree: Tree) {
  const projects = await getProjectsFilteredByDependencies(tree, [
    'npm:@angular/ssr',
  ]);

  for (const { project } of projects) {
    visitNotIgnoredFiles(tree, project.root, (path) => {
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
      const sourceFile = ts.createSourceFile(
        path,
        content,
        ts.ScriptTarget.Latest,
        true
      );
      const allImportDeclarations = sourceFile.statements.filter(
        ts.isImportDeclaration
      );

      if (allImportDeclarations.length === 0) {
        return;
      }

      const ssrImports = allImportDeclarations.filter(
        (n) =>
          ts.isStringLiteral(n.moduleSpecifier) &&
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
  const namedBindings = importDeclaration?.importClause?.namedBindings;
  if (namedBindings && ts.isNamedImports(namedBindings)) {
    return namedBindings;
  }

  return undefined;
}
