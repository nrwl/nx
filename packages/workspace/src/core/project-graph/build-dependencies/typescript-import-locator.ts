import * as ts from 'typescript';
import * as path from 'path';
import { DependencyType } from '../project-graph-models';
import { stripSourceCode } from '../../../utilities/strip-source-code';
import { FileRead } from '../../file-utils';

export class TypeScriptImportLocator {
  private readonly scanner: ts.Scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false
  );

  constructor(private readonly fileRead: FileRead) {}

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
      extension !== '.tsx' &&
      extension !== '.js' &&
      extension !== '.jsx'
    ) {
      return;
    }
    const content = this.fileRead(filePath);
    const strippedContent = stripSourceCode(this.scanner, content);
    if (strippedContent !== '') {
      const tsFile = ts.createSourceFile(
        filePath,
        strippedContent,
        ts.ScriptTarget.Latest,
        true
      );
      this.fromNode(filePath, tsFile, visitor);
    }
  }

  fromNode(
    filePath: string,
    node: ts.Node,
    visitor: (
      importExpr: string,
      filePath: string,
      type: DependencyType
    ) => void
  ): void {
    if (
      ts.isImportDeclaration(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier)
    ) {
      if (!this.ignoreStatement(node)) {
        const imp = this.getStringLiteralValue(node.moduleSpecifier);
        visitor(imp, filePath, DependencyType.static);
      }
      return; // stop traversing downwards
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      if (!this.ignoreStatement(node)) {
        const imp = this.getStringLiteralValue(node.arguments[0]);
        visitor(imp, filePath, DependencyType.dynamic);
      }
      return;
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.getText() === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      if (!this.ignoreStatement(node)) {
        const imp = this.getStringLiteralValue(node.arguments[0]);
        visitor(imp, filePath, DependencyType.static);
      }
      return;
    }

    if (node.kind === ts.SyntaxKind.PropertyAssignment) {
      const name = this.getPropertyAssignmentName(
        (node as ts.PropertyAssignment).name
      );
      if (name === 'loadChildren') {
        const init = (node as ts.PropertyAssignment).initializer;
        if (
          init.kind === ts.SyntaxKind.StringLiteral &&
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
    ts.forEachChild(node, (child) => this.fromNode(filePath, child, visitor));
  }

  private ignoreStatement(node: ts.Node) {
    return stripSourceCode(this.scanner, node.getFullText()) === '';
  }

  private ignoreLoadChildrenDependency(contents: string): boolean {
    this.scanner.setText(contents);
    let token = this.scanner.scan();
    while (token !== ts.SyntaxKind.EndOfFileToken) {
      if (
        token === ts.SyntaxKind.SingleLineCommentTrivia ||
        token === ts.SyntaxKind.MultiLineCommentTrivia
      ) {
        const start = this.scanner.getStartPos() + 2;
        token = this.scanner.scan();
        const isMultiLineCommentTrivia =
          token === ts.SyntaxKind.MultiLineCommentTrivia;
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

  private getPropertyAssignmentName(nameNode: ts.PropertyName) {
    switch (nameNode.kind) {
      case ts.SyntaxKind.Identifier:
        return (nameNode as ts.Identifier).getText();
      case ts.SyntaxKind.StringLiteral:
        return (nameNode as ts.StringLiteral).text;
      default:
        return null;
    }
  }

  private getStringLiteralValue(node: ts.Node): string {
    return node.getText().substr(1, node.getText().length - 2);
  }
}
