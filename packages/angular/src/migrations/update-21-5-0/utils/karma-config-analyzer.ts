/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Adapts the private utility from Angular CLI to be used in the migration.
 */

import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import type {
  ArrayLiteralExpression,
  CallExpression,
  Expression,
  Identifier,
  Node,
  NumericLiteral,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  PropertyAccessExpression,
  PropertyAssignment,
  StringLiteral,
} from 'typescript';

export interface RequireInfo {
  module: string;
  export?: string;
  isCall?: boolean;
  arguments?: KarmaConfigValue[];
}

export type KarmaConfigValue =
  | string
  | boolean
  | number
  | KarmaConfigValue[]
  | { [key: string]: KarmaConfigValue }
  | RequireInfo
  | undefined;

export interface KarmaConfigAnalysis {
  settings: Map<string, KarmaConfigValue>;
  hasUnsupportedValues: boolean;
}

let ts: typeof import('typescript');

/**
 * Analyzes the content of a Karma configuration file to extract its settings.
 *
 * @param content The string content of the `karma.conf.js` file.
 * @returns An object containing the configuration settings and a flag indicating if unsupported values were found.
 */
export function analyzeKarmaConfig(content: string): KarmaConfigAnalysis {
  if (!ts) {
    ts = ensureTypescript();
  }

  const sourceFile = ts.createSourceFile(
    'karma.conf.js',
    content,
    ts.ScriptTarget.Latest,
    true
  );
  const settings = new Map<string, KarmaConfigValue>();
  let hasUnsupportedValues = false;

  function visit(node: Node) {
    // The Karma configuration is defined within a `config.set({ ... })` call.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === 'config' &&
      node.expression.name.text === 'set' &&
      node.arguments.length === 1 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      // We found `config.set`, now we extract the properties from the object literal.
      for (const prop of node.arguments[0].properties) {
        if (isSupportedPropertyAssignment(prop)) {
          const key = prop.name.text;
          const value = extractValue(prop.initializer);
          settings.set(key, value);
        } else {
          hasUnsupportedValues = true;
        }
      }
    } else {
      ts.forEachChild(node, visit);
    }
  }

  function extractValue(node: Expression): KarmaConfigValue {
    switch (node.kind) {
      case ts.SyntaxKind.StringLiteral:
        return (node as StringLiteral).text;
      case ts.SyntaxKind.NumericLiteral:
        return Number((node as NumericLiteral).text);
      case ts.SyntaxKind.TrueKeyword:
        return true;
      case ts.SyntaxKind.FalseKeyword:
        return false;
      case ts.SyntaxKind.Identifier: {
        const identifier = (node as Identifier).text;
        if (identifier === '__dirname' || identifier === '__filename') {
          return identifier;
        }
        break;
      }
      case ts.SyntaxKind.CallExpression: {
        const callExpr = node as CallExpression;
        // Handle require('...')
        if (
          ts.isIdentifier(callExpr.expression) &&
          callExpr.expression.text === 'require' &&
          callExpr.arguments.length === 1 &&
          ts.isStringLiteral(callExpr.arguments[0])
        ) {
          return { module: callExpr.arguments[0].text };
        }

        // Handle calls on a require, e.g. require('path').join()
        const calleeValue = extractValue(callExpr.expression);
        if (isRequireInfo(calleeValue)) {
          return {
            ...calleeValue,
            isCall: true,
            arguments: callExpr.arguments.map(extractValue),
          };
        }
        break;
      }
      case ts.SyntaxKind.PropertyAccessExpression: {
        const propAccessExpr = node as PropertyAccessExpression;

        // Handle config constants like `config.LOG_INFO`
        if (
          ts.isIdentifier(propAccessExpr.expression) &&
          propAccessExpr.expression.text === 'config'
        ) {
          return `config.${propAccessExpr.name.text}`;
        }

        const value = extractValue(propAccessExpr.expression);
        if (isRequireInfo(value)) {
          const currentExport = value.export
            ? `${value.export}.${propAccessExpr.name.text}`
            : propAccessExpr.name.text;

          return { ...value, export: currentExport };
        }
        break;
      }
      case ts.SyntaxKind.ArrayLiteralExpression:
        return (node as ArrayLiteralExpression).elements.map(extractValue);
      case ts.SyntaxKind.ObjectLiteralExpression: {
        const obj: { [key: string]: KarmaConfigValue } = {};
        for (const prop of (node as ObjectLiteralExpression).properties) {
          if (isSupportedPropertyAssignment(prop)) {
            // Recursively extract values for nested objects.
            obj[prop.name.text] = extractValue(prop.initializer);
          } else {
            hasUnsupportedValues = true;
          }
        }

        return obj;
      }
    }

    // For complex expressions (like variables) that we don't need to resolve,
    // we mark the analysis as potentially incomplete.
    hasUnsupportedValues = true;

    return undefined;
  }

  visit(sourceFile);

  return { settings, hasUnsupportedValues };
}

function isRequireInfo(value: KarmaConfigValue): value is RequireInfo {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'module' in value
  );
}

function isSupportedPropertyAssignment(
  prop: ObjectLiteralElementLike
): prop is PropertyAssignment & { name: Identifier | StringLiteral } {
  return (
    ts.isPropertyAssignment(prop) &&
    (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
  );
}
