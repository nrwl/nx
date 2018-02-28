import * as ts from 'typescript';
import * as path from 'path';

export enum ProjectType {
  app = 'app',
  lib = 'lib'
}

export enum DependencyType {
  es6Import = 'es6Import',
  loadChildren = 'loadChildren'
}

export type ProjectNode = { name: string; root: string; type: ProjectType; files: string[] };
export type Dependency = { projectName: string; type: DependencyType };

export function touchedProjects(projects: ProjectNode[], touchedFiles: string[]) {
  projects = normalizeProjects(projects);
  touchedFiles = normalizeFiles(touchedFiles);
  return touchedFiles.map(f => {
    const p = projects.filter(project => project.files.indexOf(f) > -1)[0];
    return p ? p.name : null;
  });
}

export function affectedApps(
  npmScope: string,
  projects: ProjectNode[],
  fileRead: (s: string) => string,
  touchedFiles: string[]
): string[] {
  projects = normalizeProjects(projects);
  const deps = dependencies(npmScope, projects, fileRead);
  const tp = touchedProjects(projects, touchedFiles);
  if (tp.indexOf(null) > -1) {
    return projects.filter(p => p.type === ProjectType.app).map(p => p.name);
  } else {
    return projects.filter(p => p.type === ProjectType.app).map(p => p.name).filter(name => hasDependencyOnTouchedProjects(name, tp, deps, []));
  }
}

function hasDependencyOnTouchedProjects(project: string, touchedProjects: string[], deps: { [projectName: string]: Dependency[] }, visisted: string[]) {
  if (touchedProjects.indexOf(project) > -1) return true;
  if (visisted.indexOf(project) > -1) return false;
  return deps[project].map(d => d.projectName).filter(k => hasDependencyOnTouchedProjects(k, touchedProjects, deps, [...visisted, project])).length > 0;
}

function normalizeProjects(projects: ProjectNode[]) {
  return projects.map(p => {
    return {
      ...p,
      files: normalizeFiles(p.files)
    };
  });
}

function normalizeFiles(files: string[]): string[] {
  return files.map(f => f.replace(/[\\\/]+/g, '/'));
}

export function dependencies(
  npmScope: string,
  projects: ProjectNode[],
  fileRead: (s: string) => string
): { [projectName: string]: Dependency[] } {
  return new Deps(npmScope, projects, fileRead).calculateDeps();
}

class Deps {
  private deps: { [projectName: string]: Dependency[] };

  constructor(private npmScope: string, private projects: ProjectNode[], private fileRead: (s: string) => string) {
    this.projects.sort((a, b) => {
      if (!a.name) return -1;
      if (!b.name) return -1;
      return a.name.length > b.name.length ? -1 : 1;
    });
  }

  calculateDeps() {
    this.deps = this.projects.reduce((m, c) => ({...m, [c.name]: []}), {});
    this.processAllFiles();
    return this.deps;
    // return this.includeTransitive();
  }

  private processAllFiles() {
    this.projects.forEach(p => {
      p.files.forEach(f => {
        this.processFile(p.name, f);
      });
    });
  }

  private processFile(projectName: string, filePath: string): void {
    if (path.extname(filePath) === '.ts') {
      const tsFile = ts.createSourceFile(filePath, this.fileRead(filePath), ts.ScriptTarget.Latest, true);
      this.processNode(projectName, tsFile);
    }
  }

  private processNode(projectName: string, node: ts.Node): void {
    if (node.kind === ts.SyntaxKind.ImportDeclaration) {
      const imp = this.getStringLiteralValue((node as ts.ImportDeclaration).moduleSpecifier);
      this.addDepIfNeeded(imp, projectName, DependencyType.es6Import);
      return; // stop traversing downwards
    }

    if (node.kind === ts.SyntaxKind.PropertyAssignment) {
      const name = this.getPropertyAssignmentName((node as ts.PropertyAssignment).name);
      if (name === 'loadChildren') {
        const init = (node as ts.PropertyAssignment).initializer;
        if (init.kind === ts.SyntaxKind.StringLiteral) {
          const childrenExpr = this.getStringLiteralValue(init);
          this.addDepIfNeeded(childrenExpr, projectName, DependencyType.loadChildren);
          return; // stop traversing downwards
        }
      }
    }
    /**
     * Continue traversing down the AST from the current node
     */
    ts.forEachChild(node, child => this.processNode(projectName, child));
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

  private addDepIfNeeded(expr: string, projectName: string, depType: DependencyType) {
    const matchingProject = this.projectNames.filter(
      a =>
        expr === `@${this.npmScope}/${a}` ||
        expr.startsWith(`@${this.npmScope}/${a}#`) ||
        expr.startsWith(`@${this.npmScope}/${a}/`)
    )[0];

    if (matchingProject) {
      this.deps[projectName].push({projectName: matchingProject, type: depType});
    }
  }

  private getStringLiteralValue(node: ts.Node): string {
    return node.getText().substr(1, node.getText().length - 2);
  }

  private get projectNames(): string[] {
    return this.projects.map(p => p.name);
  }
}
