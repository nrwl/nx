/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  chain,
  DirEntry,
  Rule,
  UpdateRecorder,
} from '@angular-devkit/schematics';
import * as ts from 'typescript';
import { formatFiles } from '@nrwl/workspace';

function* visit(directory: DirEntry): IterableIterator<ts.SourceFile> {
  for (const path of directory.subfiles) {
    if (path.endsWith('.ts') && !path.endsWith('.d.ts')) {
      const entry = directory.file(path);
      if (entry) {
        const content = entry.content;
        if (
          content.includes('@angular/platform-server') &&
          content.includes('renderModule')
        ) {
          const source = ts.createSourceFile(
            entry.path,
            content.toString().replace(/^\uFEFF/, ''),
            ts.ScriptTarget.Latest,
            true
          );

          yield source;
        }
      }
    }
  }

  for (const path of directory.subdirs) {
    if (path === 'node_modules' || path.startsWith('.')) {
      continue;
    }

    yield* visit(directory.dir(path));
  }
}

export default function (): Rule {
  return chain([
    (tree) => {
      for (const sourceFile of visit(tree.root)) {
        let recorder: UpdateRecorder | undefined;
        let printer: ts.Printer | undefined;

        ts.forEachChild(sourceFile, function analyze(node) {
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

          recorder ??= tree.beginUpdate(sourceFile.fileName);

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
              sourceFile
            );

            const index = exportClause.getStart();
            const length = exportClause.getWidth();
            recorder.remove(index, length).insertLeft(index, fix);
          } else {
            // Delete export as no exports remain.
            recorder.remove(node.getStart(), node.getWidth());
          }

          ts.forEachChild(node, analyze);
        });

        if (recorder) {
          tree.commitUpdate(recorder);
        }
      }
    },
    formatFiles(),
  ]);
}
