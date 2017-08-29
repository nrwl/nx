/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {Tree} from '@angular-devkit/schematics';
import {getDecoratorMetadata} from '@schematics/angular/utility/ast-utils';
import {Change, InsertChange, NoopChange} from '@schematics/angular/utility/change';
import * as ts from 'typescript';


// This should be moved to @schematics/angular once it allows to pass custom expressions as providers
function _addSymbolToNgModuleMetadata(
    source: ts.SourceFile, ngModulePath: string, metadataField: string, expression: string): Change[] {
  const nodes = getDecoratorMetadata(source, 'NgModule', '@angular/core');
  let node: any = nodes[0];  // tslint:disable-line:no-any

  // Find the decorator declaration.
  if (!node) {
    return [];
  }

  // Get all the children property assignment of object literals.
  const matchingProperties: ts.ObjectLiteralElement[] =
      (node as ts.ObjectLiteralExpression)
          .properties
          .filter(prop => prop.kind == ts.SyntaxKind.PropertyAssignment)
          // Filter out every fields that's not "metadataField". Also handles string literals
          // (but not expressions).
          .filter((prop: ts.PropertyAssignment) => {
            const name = prop.name;
            switch (name.kind) {
              case ts.SyntaxKind.Identifier:
                return (name as ts.Identifier).getText(source) == metadataField;
              case ts.SyntaxKind.StringLiteral:
                return (name as ts.StringLiteral).text == metadataField;
            }

            return false;
          });

  // Get the last node of the array literal.
  if (!matchingProperties) {
    return [];
  }
  if (matchingProperties.length == 0) {
    // We haven't found the field in the metadata declaration. Insert a new field.
    const expr = node as ts.ObjectLiteralExpression;
    let position: number;
    let toInsert: string;
    if (expr.properties.length == 0) {
      position = expr.getEnd() - 1;
      toInsert = `  ${metadataField}: [${expression}]\n`;
    } else {
      node = expr.properties[expr.properties.length - 1];
      position = node.getEnd();
      // Get the indentation of the last element, if any.
      const text = node.getFullText(source);
      if (text.match('^\r?\r?\n')) {
        toInsert = `,${text.match(/^\r?\n\s+/)[0]}${metadataField}: [${expression}]`;
      } else {
        toInsert = `, ${metadataField}: [${expression}]`;
      }
    }
    const newMetadataProperty = new InsertChange(ngModulePath, position, toInsert);
    return [newMetadataProperty];
  }

  const assignment = matchingProperties[0] as ts.PropertyAssignment;

  // If it's not an array, nothing we can do really.
  if (assignment.initializer.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
    return [];
  }

  const arrLiteral = assignment.initializer as ts.ArrayLiteralExpression;
  if (arrLiteral.elements.length == 0) {
    // Forward the property.
    node = arrLiteral;
  } else {
    node = arrLiteral.elements;
  }

  if (!node) {
    console.log('No app module found. Please add your new class to your component.');

    return [];
  }

  if (Array.isArray(node)) {
    const nodeArray = node as {} as Array<ts.Node>;
    const symbolsArray = nodeArray.map(node => node.getText());
    if (symbolsArray.includes(expression)) {
      return [];
    }

    node = node[node.length - 1];
  }

  let toInsert: string;
  let position = node.getEnd();
  if (node.kind == ts.SyntaxKind.ObjectLiteralExpression) {
    // We haven't found the field in the metadata declaration. Insert a new
    // field.
    const expr = node as ts.ObjectLiteralExpression;
    if (expr.properties.length == 0) {
      position = expr.getEnd() - 1;
      toInsert = `  ${metadataField}: [${expression}]\n`;
    } else {
      node = expr.properties[expr.properties.length - 1];
      position = node.getEnd();
      // Get the indentation of the last element, if any.
      const text = node.getFullText(source);
      if (text.match('^\r?\r?\n')) {
        toInsert = `,${text.match(/^\r?\n\s+/)[0]}${metadataField}: [${expression}]`;
      } else {
        toInsert = `, ${metadataField}: [${expression}]`;
      }
    }
  } else if (node.kind == ts.SyntaxKind.ArrayLiteralExpression) {
    // We found the field but it's empty. Insert it just before the `]`.
    position--;
    toInsert = `${expression}`;
  } else {
    // Get the indentation of the last element, if any.
    const text = node.getFullText(source);
    if (text.match(/^\r?\n/)) {
      toInsert = `,${text.match(/^\r?\n(\r?)\s+/)[0]}${expression}`;
    } else {
      toInsert = `, ${expression}`;
    }
  }
  const insert = new InsertChange(ngModulePath, position, toInsert);
  return [insert];
}

export function addImportToModule(source: ts.SourceFile, modulePath: string, symbolName: string): Change[] {
  return _addSymbolToNgModuleMetadata(
      source,
      modulePath,
      'imports',
      symbolName,
  );
}

export function addProviderToModule(source: ts.SourceFile, modulePath: string, symbolName: string): Change[] {
  return _addSymbolToNgModuleMetadata(source, modulePath, 'providers', symbolName);
}


export function insert(host: Tree, modulePath: string, changes: Change[]) {
  const recorder = host.beginUpdate(modulePath);
  for (const change of changes) {
    if (change instanceof InsertChange) {
      recorder.insertLeft(change.pos, change.toAdd);
    } else if (change instanceof NoopChange) {
      // do nothing
    } else {
      throw new Error(`Unexpected Change '${change}'`);
    }
  }
  host.commitUpdate(recorder);
}
