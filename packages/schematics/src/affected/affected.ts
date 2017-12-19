import * as ts from 'typescript';

export type Project = { name: string; isApp: boolean; files: string[] };

export function affectedApps(
  npmScope: string,
  projects: Project[],
  fileRead: (s: string) => string,
  touchedFiles: string[]
): string[] {
  const deps = dependencies(npmScope, projects, fileRead);

  const touchedProjects = touchedFiles.map(f => {
    const p = projects.filter(project => project.files.indexOf(f) > -1)[0];
    return p ? p.name : null;
  });

  if (touchedProjects.indexOf(null) > -1) {
    return projects.filter(p => p.isApp).map(p => p.name);
  }

  return projects
    .filter(p => p.isApp && deps[p.name].filter(dep => touchedProjects.indexOf(dep) > -1).length > 0)
    .map(p => p.name);
}

export function dependencies(
  npmScope: string,
  projects: Project[],
  fileRead: (s: string) => string
): { [appName: string]: string[] } {
  return new Deps(npmScope, projects, fileRead).calculateDeps();
}

class Deps {
  private deps: { [appName: string]: string[] };

  constructor(private npmScope: string, private projects: Project[], private fileRead: (s: string) => string) {}

  calculateDeps() {
    this.deps = this.projects.reduce((m, c) => ({ ...m, [c.name]: [] }), {});
    this.processAllFiles();
    return this.includeTransitive();
  }

  private processAllFiles() {
    this.projects.forEach(p => {
      p.files.forEach(f => {
        this.processFile(p.name, f);
      });
    });
  }

  private includeTransitive() {
    const res = {};
    Object.keys(this.deps).forEach(project => {
      res[project] = this.transitiveDeps(project);
    });
    return res;
  }

  private transitiveDeps(project: string): string[] {
    let res = [project];

    this.deps[project].forEach(d => {
      res = [...res, ...this.transitiveDeps(d)];
    });

    return Array.from(new Set(res));
  }

  private processFile(projectName: string, filePath: string): void {
    const tsFile = ts.createSourceFile(filePath, this.fileRead(filePath), ts.ScriptTarget.Latest, true);
    this.processNode(projectName, tsFile);
  }

  private processNode(projectName: string, node: ts.Node): void {
    if (node.kind === ts.SyntaxKind.ImportDeclaration) {
      const imp = this.getStringLiteralValue((node as ts.ImportDeclaration).moduleSpecifier);
      this.addDepIfNeeded(imp, projectName);
    } else if (node.kind === ts.SyntaxKind.PropertyAssignment) {
      const name = this.getPropertyAssignmentName((node as ts.PropertyAssignment).name);
      if (name === 'loadChildren') {
        const init = (node as ts.PropertyAssignment).initializer;
        if (init.kind === ts.SyntaxKind.StringLiteral) {
          const childrenExpr = this.getStringLiteralValue(init);
          this.addDepIfNeeded(childrenExpr, projectName);
        }
      }
    } else {
      ts.forEachChild(node, child => this.processNode(projectName, child));
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

  private addDepIfNeeded(expr: string, projectName: string) {
    const matchingProject = this.projectNames.filter(
      a =>
        expr === `@${this.npmScope}/${a}` ||
        expr.startsWith(`@${this.npmScope}/${a}#`) ||
        expr.startsWith(`@${this.npmScope}/${a}/`)
    )[0];

    if (matchingProject) {
      this.deps[projectName].push(matchingProject);
    }
  }

  private getStringLiteralValue(node: ts.Node): string {
    return node.getText().substr(1, node.getText().length - 2);
  }

  private get projectNames(): string[] {
    return this.projects.map(p => p.name);
  }
}
