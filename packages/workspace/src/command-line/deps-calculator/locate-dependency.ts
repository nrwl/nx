import * as path from 'path';
import * as ts from 'typescript';
import { stripSourceCode } from '../../utils/strip-source-code';

import {
  Dependency,
  DependencyType,
  PackageJson,
  ProjectNode
} from '../shared-models';
import { normalizedProjectRoot } from '../shared-utils';

type FileRead = (s: string) => string;
type DependencyVisitor = (x: Dependency) => void;

export class TypeScriptDependencyLocator {
  private readonly scanner: ts.Scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false
  );

  private readonly packageDependencies: Record<string, string>;

  constructor(
    private readonly npmScope: string,
    private readonly projects: ProjectNode[],
    private readonly packageJson: PackageJson,
    private readonly fileRead: FileRead
  ) {
    this.packageDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies
    };
  }

  process(filePath: string, visitor: DependencyVisitor) {
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
      this.processNode(filePath, tsFile, visitor);
    }
  }

  private processNode(
    filePath: string,
    node: ts.Node,
    visitor: DependencyVisitor
  ) {
    const result =
      this.findProjectImport(node, this.npmScope, this.projects) ||
      this.findNodeModuleImport(node, this.packageDependencies);
    if (result) {
      visitor({ projectName: result.target, type: result.type });
    } else {
      ts.forEachChild(node, child =>
        this.processNode(filePath, child, visitor)
      );
    }
  }

  private findProjectImport(
    node: ts.Node,
    npmScope: string,
    projects: ProjectNode[]
  ) {
    let type: DependencyType;
    let imported = this.getStaticImport(node);

    if (imported) {
      type = DependencyType.es6Import;
    } else {
      imported =
        this.getDynamicImport(node) || this.getLoadChildrenProjectImport(node);
      if (imported) {
        type = DependencyType.loadChildren;
      }
    }

    if (imported) {
      const project = this.matchProject(imported, npmScope, projects);
      if (project) {
        return {
          target: project.name,
          type
        };
      }
    }
  }

  private findNodeModuleImport(
    node: ts.Node,
    packageDeps: Record<string, string>
  ) {
    const imported = this.getStaticImport(node) || this.getDynamicImport(node);
    if (imported && packageDeps[imported]) {
      return {
        type: DependencyType.nodeModule,
        target: imported
      };
    }
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

  private matchProject(
    expr: string,
    npmScope: string,
    projects: ProjectNode[]
  ) {
    return projects.filter(a => {
      const normalizedRoot = normalizedProjectRoot(a);
      return (
        expr === `@${npmScope}/${normalizedRoot}` ||
        expr.startsWith(`@${npmScope}/${normalizedRoot}#`) ||
        expr.startsWith(`@${npmScope}/${normalizedRoot}/`)
      );
    })[0];
  }

  private getLoadChildrenProjectImport(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.PropertyAssignment) {
      const name = this.getPropertyAssignmentName(
        (node as ts.PropertyAssignment).name
      );
      if (name === 'loadChildren') {
        const init = (node as ts.PropertyAssignment).initializer;
        if (init.kind === ts.SyntaxKind.StringLiteral) {
          return this.getStringLiteralValue(init);
        }
      }
    }
  }

  private getStaticImport(node: ts.Node): void | string {
    if (
      ts.isImportDeclaration(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier)
    ) {
      return this.getStringLiteralValue(node.moduleSpecifier);
    }
  }

  private getDynamicImport(node: ts.Node): void | string {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      return this.getStringLiteralValue(node.arguments[0]);
    }
  }

  private getStringLiteralValue(node: ts.Node): string {
    return node.getText().substr(1, node.getText().length - 2);
  }
}
