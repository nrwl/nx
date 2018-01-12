import * as path from 'path';
import * as Lint from 'tslint';
import { IOptions } from 'tslint';
import * as ts from 'typescript';
import { readFileSync } from 'fs';

export class Rule extends Lint.Rules.AbstractRule {
  constructor(
    options: IOptions,
    private path?: string,
    private npmScope?: string,
    private libNames?: string[],
    private appNames?: string[]
  ) {
    super(options);
    if (!path) {
      const cliConfig = this.readCliConfig();
      this.path = process.cwd();
      this.npmScope = cliConfig.project.npmScope;
      this.libNames = cliConfig.apps.filter(p => p.root.startsWith('libs/')).map(a => a.name);
      this.appNames = cliConfig.apps.filter(p => p.root.startsWith('apps/')).map(a => a.name);
    }
  }

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(
      new EnforceModuleBoundariesWalker(
        sourceFile,
        this.getOptions(),
        this.path,
        this.npmScope,
        this.libNames,
        this.appNames
      )
    );
  }

  private readCliConfig(): any {
    return JSON.parse(readFileSync(`.angular-cli.json`, 'UTF-8'));
  }
}

class EnforceModuleBoundariesWalker extends Lint.RuleWalker {
  constructor(
    sourceFile: ts.SourceFile,
    options: IOptions,
    private projectPath: string,
    private npmScope: string,
    private libNames: string[],
    private appNames: string[]
  ) {
    super(sourceFile, options);
  }

  public visitImportDeclaration(node: ts.ImportDeclaration) {
    const imp = node.moduleSpecifier.getText().substring(1, node.moduleSpecifier.getText().length - 1);
    const allow: string[] = Array.isArray(this.getOptions()[0].allow)
      ? this.getOptions()[0].allow.map(a => `${a}`)
      : [];
    const lazyLoad: string[] = Array.isArray(this.getOptions()[0].lazyLoad)
      ? this.getOptions()[0].lazyLoad.map(a => `${a}`)
      : [];

    // whitelisted import => return
    if (allow.indexOf(imp) > -1) {
      super.visitImportDeclaration(node);
      return;
    }

    const lazyLoaded = lazyLoad.filter(l => imp.startsWith(`@${this.npmScope}/${l}`))[0];
    if (lazyLoaded) {
      this.addFailureAt(node.getStart(), node.getWidth(), 'imports of lazy-loaded libraries are forbidden');
      return;
    }

    if (this.libNames.filter(l => imp === `@${this.npmScope}/${l}`).length > 0) {
      super.visitImportDeclaration(node);
      return;
    }

    if (this.isRelativeImportIntoAnotherProject(imp) || this.isAbsoluteImportIntoAnotherProject(imp)) {
      this.addFailureAt(node.getStart(), node.getWidth(), `library imports must start with @${this.npmScope}/`);
      return;
    }

    const deepImport = this.libNames.filter(l => imp.startsWith(`@${this.npmScope}/${l}/`))[0];
    if (deepImport) {
      this.addFailureAt(node.getStart(), node.getWidth(), 'deep imports into libraries are forbidden');
      return;
    }

    const appImport = this.appNames.filter(
      a => imp.startsWith(`@${this.npmScope}/${a}/`) || imp === `@${this.npmScope}/${a}`
    )[0];
    if (appImport) {
      this.addFailureAt(node.getStart(), node.getWidth(), 'imports of apps are forbidden');
      return;
    }

    super.visitImportDeclaration(node);
  }

  private isRelativeImportIntoAnotherProject(imp: string): boolean {
    if (!this.isRelative(imp)) return false;
    const sourceFile = this.getSourceFile().fileName.substring(this.projectPath.length);
    const targetFile = path.resolve(path.dirname(sourceFile), imp);
    if (this.workspacePath(sourceFile) && this.workspacePath(targetFile)) {
      if (this.parseProject(sourceFile) !== this.parseProject(targetFile)) {
        return true;
      }
    }
    return false;
  }

  private isAbsoluteImportIntoAnotherProject(imp: string): boolean {
    return imp.startsWith('libs/') || (imp.startsWith('/libs/') && imp.startsWith('apps/')) || imp.startsWith('/apps/');
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
