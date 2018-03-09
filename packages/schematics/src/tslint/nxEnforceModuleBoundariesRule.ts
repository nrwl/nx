import * as path from 'path';
import * as Lint from 'tslint';
import { IOptions } from 'tslint';
import * as ts from 'typescript';
import { readFileSync } from 'fs';
import * as appRoot from 'app-root-path';

export class Rule extends Lint.Rules.AbstractRule {
  constructor(
    options: IOptions,
    private readonly projectPath?: string,
    private readonly npmScope?: string,
    private readonly libNames?: string[],
    private readonly appNames?: string[],
    private readonly roots?: string[]
  ) {
    super(options);
    if (!projectPath) {
      this.projectPath = appRoot.path;
      const cliConfig = this.readCliConfig(this.projectPath);
      this.npmScope = cliConfig.project.npmScope;
      this.libNames = cliConfig.apps.filter(p => p.root.startsWith('libs/')).map(a => a.name);
      this.appNames = cliConfig.apps.filter(p => p.root.startsWith('apps/')).map(a => a.name);
      this.roots = cliConfig.apps.map(a => path.dirname(a.root));
    }
  }

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(
      new EnforceModuleBoundariesWalker(
        sourceFile,
        this.getOptions(),
        this.projectPath,
        this.npmScope,
        this.libNames,
        this.appNames,
        this.roots
      )
    );
  }

  private readCliConfig(projectPath: string): any {
    return JSON.parse(readFileSync(`${projectPath}/.angular-cli.json`, 'UTF-8'));
  }
}

class EnforceModuleBoundariesWalker extends Lint.RuleWalker {
  constructor(
    sourceFile: ts.SourceFile,
    options: IOptions,
    private projectPath: string,
    private npmScope: string,
    private libNames: string[],
    private appNames: string[],
    private roots: string[]
  ) {
    super(sourceFile, options);
    this.roots = [...roots].sort((a, b) => a.length - b.length);
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
    const targetFile = this.getTargetFile(imp, sourceFile);
    if (!this.libraryRoot()) return false;
    return !(targetFile.startsWith(`${this.libraryRoot()}/`) || targetFile === this.libraryRoot());
  }

  private getTargetFile(imp: string, sourceFile: string): string {
    let targetFile = path.resolve(path.dirname(sourceFile), imp).substring(1); // remove leading slash
    if (targetFile.startsWith(':')) {
      // windows compatibility
      targetFile = targetFile.substring(2); // remove ":\"
      targetFile = targetFile.split(path.sep).join('/'); // replace "\" with "/"
    }
    return targetFile;
  }

  private libraryRoot(): string {
    const sourceFile = this.getSourceFile().fileName.substring(this.projectPath.length + 1);
    return this.roots.filter(r => sourceFile.startsWith(`${r}/`))[0];
  }

  private isAbsoluteImportIntoAnotherProject(imp: string): boolean {
    return imp.startsWith('libs/') || (imp.startsWith('/libs/') && imp.startsWith('apps/')) || imp.startsWith('/apps/');
  }

  private isRelative(s: string): boolean {
    return s.startsWith('.');
  }
}
