import * as path from 'path';
import * as Lint from 'tslint';
import { IOptions } from 'tslint';
import * as ts from 'typescript';
import { readFileSync } from 'fs';
import * as appRoot from 'app-root-path';
import {getProjectNodes} from '../command-line/shared';
import {dependencies, Dependency, DependencyType, ProjectNode, ProjectType} from '../command-line/affected-apps';

export class Rule extends Lint.Rules.AbstractRule {
  constructor(
    options: IOptions,
    private readonly projectPath?: string,
    private readonly npmScope?: string,
    private readonly projectNodes?: ProjectNode[],
    private readonly deps?: { [projectName: string]: Dependency[] },
  ) {
    super(options);
    if (!projectPath) {
      this.projectPath = appRoot.path;
      const cliConfig = this.readCliConfig(this.projectPath);
      this.npmScope = cliConfig.project.npmScope;
      this.projectNodes = getProjectNodes(cliConfig);
      this.deps = dependencies(this.npmScope, this.projectNodes, f => readFileSync(f).toString());
    }
  }

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(
      new EnforceModuleBoundariesWalker(
        sourceFile,
        this.getOptions(),
        this.projectPath,
        this.npmScope,
        this.projectNodes,
        this.deps
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
    private readonly projectPath: string,
    private readonly npmScope: string,
    private readonly projectNodes: ProjectNode[],
    private readonly deps: { [projectName: string]: Dependency[] }
  ) {
    super(sourceFile, options);
  }

  public visitImportDeclaration(node: ts.ImportDeclaration) {
    const imp = node.moduleSpecifier.getText().substring(1, node.moduleSpecifier.getText().length - 1);
    const allow: string[] = Array.isArray(this.getOptions()[0].allow)
      ? this.getOptions()[0].allow.map(a => `${a}`)
      : [];

    // whitelisted import => return
    if (allow.indexOf(imp) > -1) {
      super.visitImportDeclaration(node);
      return;
    }

    if (this.isRelativeImportIntoAnotherProject(imp) || this.isAbsoluteImportIntoAnotherProject(imp)) {
      this.addFailureAt(node.getStart(), node.getWidth(), `library imports must start with @${this.npmScope}/`);
      return;
    }

    if (imp.startsWith(`@${this.npmScope}/`)) {
      const name = imp.split('/')[1];
      const sourceProject = this.findSourceProject();
      const targetProject = this.findProjectUsingName(name);

      if (sourceProject === targetProject || !targetProject) {
        super.visitImportDeclaration(node);
        return;
      }

      if (targetProject.type === ProjectType.app) {
        this.addFailureAt(node.getStart(), node.getWidth(), 'imports of apps are forbidden');
        return;
      }

      if (imp.split('/').length > 2) {
        this.addFailureAt(node.getStart(), node.getWidth(), 'deep imports into libraries are forbidden');
        return;
      }

      if (this.onlyLoadChildren(sourceProject.name, targetProject.name, [])) {
        this.addFailureAt(node.getStart(), node.getWidth(), 'imports of lazy-loaded libraries are forbidden');
        return;
      }
    }

    super.visitImportDeclaration(node);
  }

  private onlyLoadChildren(source: string, target: string, path: string[]) {
    if (path.indexOf(source) > -1) return false;
    return (this.deps[source] || []).filter(d => {
      if (d.type !== DependencyType.loadChildren) return false;
      if (d.projectName === target) return true;
      return this.onlyLoadChildren(d.projectName, target, [...path, source]);
    }).length > 0;
  }

  private isRelativeImportIntoAnotherProject(imp: string): boolean {
    if (!this.isRelative(imp)) return false;

    const targetFile = path
      .resolve(path.join(this.projectPath, path.dirname(this.getSourceFilePath())), imp)
      .split(path.sep)
      .join('/')
      .substring(this.projectPath.length + 1);
    const sourceProject = this.findSourceProject();

    let targetProject = this.findProjectUsingFile(targetFile);
    if (!targetProject) {
      targetProject = this.findProjectUsingFile(path.join(targetFile, 'index'));
    }
    return sourceProject !== targetProject || targetProject === undefined;
  }

  private findSourceProject() {
    return this.projectNodes.filter(n => {
     return n.files.filter(f => removeExt(f) === removeExt(this.getSourceFilePath()))[0];
    })[0];
  }

  private getSourceFilePath() {
    return this.getSourceFile().fileName.substring(this.projectPath.length + 1);
  }

  private findProjectUsingFile(file: string) {
    return this.projectNodes.filter(n => {
     return n.files.filter(f => removeExt(f) === file)[0];
    })[0];
  }

  private findProjectUsingName(name: string) {
    return this.projectNodes.filter(n => n.name === name)[0];
  }

  private isAbsoluteImportIntoAnotherProject(imp: string): boolean {
    return imp.startsWith('libs/') || (imp.startsWith('/libs/') && imp.startsWith('apps/')) || imp.startsWith('/apps/');
  }

  private isRelative(s: string): boolean {
    return s.startsWith('.');
  }
}

function removeExt(file:string): string {
  return file.replace(/\.[^/.]+$/, "");
}