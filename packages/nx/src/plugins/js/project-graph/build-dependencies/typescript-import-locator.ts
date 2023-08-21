import type {
  Identifier,
  Node,
  PropertyAssignment,
  PropertyName,
  Scanner,
  StringLiteral,
} from 'typescript';
import * as path from 'path';
import { DependencyType } from '../../../../config/project-graph';
import { defaultFileRead } from '../../../../project-graph/file-utils';

let SyntaxKind: typeof import('typescript').SyntaxKind;

let tsModule: typeof import('typescript');

/**
 * @deprecated This is deprecated and will be removed in Nx 18.
 * This was not intended to be exposed.
 * Please talk to us if you need this.
 */
export class TypeScriptImportLocator {
  private readonly scanner: Scanner;

  constructor() {
    tsModule = require('typescript');
    this.scanner = tsModule.createScanner(tsModule.ScriptTarget.Latest, false);
  }

  fromFile(
    filePath: string,
    visitor: (
      importExpr: string,
      filePath: string,
      type: DependencyType
    ) => void
  ): void {
    const extension = path.extname(filePath);
    if (
      extension !== '.ts' &&
      extension !== '.mts' &&
      extension !== '.tsx' &&
      extension !== '.js' &&
      extension !== '.mjs' &&
      extension !== '.jsx'
    ) {
      return;
    }
    const content = defaultFileRead(filePath);
    const strippedContent = stripSourceCode(this.scanner, content);
    if (strippedContent !== '') {
      const tsFile = tsModule.createSourceFile(
        filePath,
        strippedContent,
        tsModule.ScriptTarget.Latest,
        true
      );
      this.fromNode(filePath, tsFile, visitor);
    }
  }

  fromNode(
    filePath: string,
    node: any,
    visitor: (
      importExpr: string,
      filePath: string,
      type: DependencyType
    ) => void
  ): void {
    if (
      tsModule.isImportDeclaration(node) ||
      (tsModule.isExportDeclaration(node) && node.moduleSpecifier)
    ) {
      if (!this.ignoreStatement(node)) {
        const imp = this.getStringLiteralValue(node.moduleSpecifier);
        visitor(imp, filePath, DependencyType.static);
      }
      return; // stop traversing downwards
    }

    if (
      tsModule.isCallExpression(node) &&
      node.expression.kind === tsModule.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      tsModule.isStringLiteral(node.arguments[0])
    ) {
      if (!this.ignoreStatement(node)) {
        const imp = this.getStringLiteralValue(node.arguments[0]);
        visitor(imp, filePath, DependencyType.dynamic);
      }
      return;
    }

    if (
      tsModule.isCallExpression(node) &&
      node.expression.getText() === 'require' &&
      node.arguments.length === 1 &&
      tsModule.isStringLiteral(node.arguments[0])
    ) {
      if (!this.ignoreStatement(node)) {
        const imp = this.getStringLiteralValue(node.arguments[0]);
        visitor(imp, filePath, DependencyType.static);
      }
      return;
    }

    if (node.kind === tsModule.SyntaxKind.PropertyAssignment) {
      const name = this.getPropertyAssignmentName(
        (node as PropertyAssignment).name
      );
      if (name === 'loadChildren') {
        const init = (node as PropertyAssignment).initializer;
        if (
          init.kind === tsModule.SyntaxKind.StringLiteral &&
          !this.ignoreLoadChildrenDependency(node.getFullText())
        ) {
          const childrenExpr = this.getStringLiteralValue(init);
          visitor(childrenExpr, filePath, DependencyType.dynamic);
          return; // stop traversing downwards
        }
      }
    }

    /**
     * Continue traversing down the AST from the current node
     */
    tsModule.forEachChild(node, (child) =>
      this.fromNode(filePath, child, visitor)
    );
  }

  private ignoreStatement(node: Node) {
    return stripSourceCode(this.scanner, node.getFullText()) === '';
  }

  private ignoreLoadChildrenDependency(contents: string): boolean {
    this.scanner.setText(contents);
    let token = this.scanner.scan();
    while (token !== tsModule.SyntaxKind.EndOfFileToken) {
      if (
        token === tsModule.SyntaxKind.SingleLineCommentTrivia ||
        token === tsModule.SyntaxKind.MultiLineCommentTrivia
      ) {
        const start = this.scanner.getStartPos() + 2;
        token = this.scanner.scan();
        const isMultiLineCommentTrivia =
          token === tsModule.SyntaxKind.MultiLineCommentTrivia;
        const end =
          this.scanner.getStartPos() - (isMultiLineCommentTrivia ? 2 : 0);
        const comment = contents.substring(start, end).trim();
        if (comment === 'nx-ignore-next-line') {
          return true;
        }
      } else {
        token = this.scanner.scan();
      }
    }
    return false;
  }

  private getPropertyAssignmentName(nameNode: PropertyName) {
    switch (nameNode.kind) {
      case tsModule.SyntaxKind.Identifier:
        return (nameNode as Identifier).getText();
      case tsModule.SyntaxKind.StringLiteral:
        return (nameNode as StringLiteral).text;
      default:
        return null;
    }
  }

  private getStringLiteralValue(node: Node): string {
    return node.getText().slice(1, -1);
  }
}
function shouldRescanSlashToken(
  lastNonTriviaToken: import('typescript').SyntaxKind
) {
  switch (lastNonTriviaToken) {
    case SyntaxKind.Identifier:
    case SyntaxKind.StringLiteral:
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.BigIntLiteral:
    case SyntaxKind.RegularExpressionLiteral:
    case SyntaxKind.ThisKeyword:
    case SyntaxKind.PlusPlusToken:
    case SyntaxKind.MinusMinusToken:
    case SyntaxKind.CloseParenToken:
    case SyntaxKind.CloseBracketToken:
    case SyntaxKind.CloseBraceToken:
    case SyntaxKind.TrueKeyword:
    case SyntaxKind.FalseKeyword:
      return false;
    default:
      return true;
  }
}

export function stripSourceCode(scanner: Scanner, contents: string): string {
  if (!SyntaxKind) {
    SyntaxKind = require('typescript').SyntaxKind;
  }

  if (contents.indexOf('loadChildren') > -1) {
    return contents;
  }

  scanner.setText(contents);
  let token = scanner.scan();
  let lastNonTriviaToken = SyntaxKind.Unknown;
  const statements = [];
  const templateStack = [];
  let ignoringLine = false;
  let braceDepth = 0;
  let start = null;
  while (token !== SyntaxKind.EndOfFileToken) {
    const currentToken = token;
    const potentialStart = scanner.getStartPos();
    switch (token) {
      case SyntaxKind.MultiLineCommentTrivia:
      case SyntaxKind.SingleLineCommentTrivia: {
        const isMultiLineCommentTrivia =
          token === SyntaxKind.MultiLineCommentTrivia;
        const start = potentialStart + 2;
        token = scanner.scan();
        const end = scanner.getStartPos() - (isMultiLineCommentTrivia ? 2 : 0);
        const comment = contents.substring(start, end).trim();
        if (comment === 'nx-ignore-next-line') {
          // reading till the end of the line
          while (
            token === SyntaxKind.WhitespaceTrivia ||
            token === SyntaxKind.NewLineTrivia
          ) {
            token = scanner.scan();
          }
          ignoringLine = true;
        }
        break;
      }

      case SyntaxKind.NewLineTrivia: {
        ignoringLine = false;
        token = scanner.scan();
        break;
      }

      case SyntaxKind.RequireKeyword:
      case SyntaxKind.ImportKeyword: {
        token = scanner.scan();
        if (ignoringLine) {
          break;
        }
        while (
          token === SyntaxKind.WhitespaceTrivia ||
          token === SyntaxKind.NewLineTrivia
        ) {
          token = scanner.scan();
        }
        start = potentialStart;
        break;
      }

      case SyntaxKind.TemplateHead: {
        templateStack.push(braceDepth);
        braceDepth = 0;
        token = scanner.scan();
        break;
      }

      case SyntaxKind.SlashToken: {
        if (shouldRescanSlashToken(lastNonTriviaToken)) {
          token = scanner.reScanSlashToken();
        }
        token = scanner.scan();
        break;
      }

      case SyntaxKind.OpenBraceToken: {
        ++braceDepth;
        token = scanner.scan();
        break;
      }

      case SyntaxKind.CloseBraceToken: {
        if (braceDepth) {
          --braceDepth;
        } else if (templateStack.length) {
          token = scanner.reScanTemplateToken(false);
          if (token === SyntaxKind.LastTemplateToken) {
            braceDepth = templateStack.pop();
          }
        }
        token = scanner.scan();
        break;
      }

      case SyntaxKind.ExportKeyword: {
        token = scanner.scan();
        if (ignoringLine) {
          break;
        }
        while (
          token === SyntaxKind.WhitespaceTrivia ||
          token === SyntaxKind.NewLineTrivia
        ) {
          token = scanner.scan();
        }
        if (
          token === SyntaxKind.OpenBraceToken ||
          token === SyntaxKind.AsteriskToken ||
          token === SyntaxKind.TypeKeyword
        ) {
          start = potentialStart;
        }
        break;
      }

      case SyntaxKind.StringLiteral: {
        if (start !== null) {
          token = scanner.scan();
          if (token === SyntaxKind.CloseParenToken) {
            token = scanner.scan();
          }
          const end = scanner.getStartPos();
          statements.push(contents.substring(start, end));
          start = null;
        } else {
          token = scanner.scan();
        }
        break;
      }

      default: {
        token = scanner.scan();
      }
    }

    if (currentToken > SyntaxKind.LastTriviaToken) {
      lastNonTriviaToken = currentToken;
    }
  }

  return statements.join('\n');
}
