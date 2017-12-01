import * as path from 'path';
import * as Lint from 'tslint';
import { IOptions } from 'tslint';
import * as ts from 'typescript';

export class Rule extends Lint.Rules.AbstractRule {
  constructor(options: IOptions, private path?: string) {
    super(options);
    if (!path) {
      this.path = process.cwd();
    }
  }

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(new EnforceModuleBoundariesWalker(sourceFile, this.getOptions(), this.path));
  }
}

class EnforceModuleBoundariesWalker extends Lint.RuleWalker {
  constructor(sourceFile: ts.SourceFile, options: IOptions, private projectPath: string) {
    super(sourceFile, options);
  }

  public visitImportDeclaration(node: ts.ImportDeclaration) {
    const npmScope = `@${this.getOptions()[0].npmScope}`;
    const lazyLoad = this.getOptions()[0].lazyLoad;
    const imp = node.moduleSpecifier.getText().substring(1, node.moduleSpecifier.getText().length - 1);
    const impParts = imp.split(path.sep);

    if (impParts[0] === npmScope && impParts.length > 2) {
      this.addFailureAt(node.getStart(), node.getWidth(), 'deep imports into libraries are forbidden');
    } else if (impParts[0] === npmScope && impParts.length === 2 && lazyLoad && lazyLoad.indexOf(impParts[1]) > -1) {
      this.addFailureAt(node.getStart(), node.getWidth(), 'import of lazy-loaded libraries are forbidden');
    } else if (this.isRelative(imp) && this.isRelativeImportIntoAnotherProject(imp)) {
      this.addFailureAt(node.getStart(), node.getWidth(), 'relative imports of libraries are forbidden');
    }

    super.visitImportDeclaration(node);
  }

  private isRelativeImportIntoAnotherProject(imp: string): boolean {
    const sourceFile = this.getSourceFile().fileName.substring(this.projectPath.length);
    const targetFile = path.resolve(path.dirname(sourceFile), imp);
    if (this.workspacePath(sourceFile) && this.workspacePath(targetFile)) {
      if (this.parseProject(sourceFile) !== this.parseProject(targetFile)) {
        return true;
      }
    }
    return false;
  }

  private workspacePath(s: string): boolean {
    return s.startsWith('/apps/') || s.startsWith('/libs/');
  }

  private parseProject(s: string): string {
    const rest = s.substring(6);
    const r = rest.split(path.sep);
    return r[0];
  }

  private isRelative(s: string): boolean {
    return s.startsWith('.');
  }
}
