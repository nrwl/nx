import type { Tree } from '@nx/devkit';
import { formatFiles, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';
import { FileChangeRecorder } from '../../utils/file-change-recorder';

export default async function (tree: Tree) {
  visitNotIgnoredFiles(tree, '/', (path) => {
    if (path.endsWith('.ts') && !path.endsWith('.d.ts')) {
      const content = tree.read(path, 'utf8');
      if (
        content.includes('@angular/platform-server') &&
        content.includes('renderModule')
      ) {
        const source = ts.createSourceFile(
          path,
          content.toString().replace(/^\uFEFF/, ''),
          ts.ScriptTarget.Latest,
          true
        );

        let recorder: FileChangeRecorder | undefined;
        let printer: ts.Printer | undefined;

        ts.forEachChild(source, function analyze(node) {
          if (
            !(
              ts.isExportDeclaration(node) &&
              node.moduleSpecifier &&
              ts.isStringLiteral(node.moduleSpecifier) &&
              node.moduleSpecifier.text === '@angular/platform-server' &&
              node.exportClause &&
              ts.isNamedExports(node.exportClause)
            )
          ) {
            // Not a @angular/platform-server named export.
            return;
          }

          const exportClause = node.exportClause;
          const newElements: ts.ExportSpecifier[] = [];
          for (const element of exportClause.elements) {
            if (element.name.text !== 'renderModule') {
              newElements.push(element);
            }
          }

          if (newElements.length === exportClause.elements.length) {
            // No changes
            return;
          }

          recorder ??= new FileChangeRecorder(tree, path);

          if (newElements.length) {
            // Update named exports as there are leftovers.
            const newExportClause = ts.factory.updateNamedExports(
              exportClause,
              newElements
            );
            printer ??= ts.createPrinter();
            const fix = printer.printNode(
              ts.EmitHint.Unspecified,
              newExportClause,
              source
            );

            const index = exportClause.getStart();
            const length = exportClause.getWidth();
            recorder.remove(index, index + length);
            recorder.insertLeft(index, fix);
          } else {
            // Delete export as no exports remain.
            recorder.remove(node.getStart(), node.getStart() + node.getWidth());
          }

          ts.forEachChild(node, analyze);
        });

        if (recorder) {
          recorder.applyChanges();
        }
      }
    }
  });

  await formatFiles(tree);
}
