import * as ts from 'typescript';
import * as path from 'path';
import { normalizedProjectRoot } from '@nrwl/schematics/src/command-line/shared';

export enum ProjectType {
  app = 'app',
  e2e = 'e2e',
  lib = 'lib'
}

export enum DependencyType {
  es6Import = 'es6Import',
  loadChildren = 'loadChildren',
  implicit = 'implicit'
}

export type ProjectNode = {
  name: string;
  root: string;
  type: ProjectType;
  tags: string[];
  files: string[];
  architect: { [k: string]: any };
};
export type Dependency = { projectName: string; type: DependencyType };

export type DepGraph = {
  projects: ProjectNode[];
  deps: { [projectName: string]: Dependency[] };
  npmScope: string;
};

export function touchedProjects(
  projects: ProjectNode[],
  touchedFiles: string[]
) {
  projects = normalizeProjects(projects);
  touchedFiles = normalizeFiles(touchedFiles);
  return touchedFiles.map(f => {
    const p = projects.filter(project => project.files.indexOf(f) > -1)[0];
    return p ? p.name : null;
  });
}

function affectedProjects(
  npmScope: string,
  projects: ProjectNode[],
  fileRead: (s: string) => string,
  touchedFiles: string[]
): ProjectNode[] {
  projects = normalizeProjects(projects);
  const deps = dependencies(npmScope, projects, fileRead);
  const tp = touchedProjects(projects, touchedFiles);
  if (tp.indexOf(null) > -1) {
    return projects;
  } else {
    return projects.filter(proj =>
      hasDependencyOnTouchedProjects(proj.name, tp, deps, [])
    );
  }
}

export type AffectedFetcher = (
  npmScope: string,
  projects: ProjectNode[],
  fileRead: (s: string) => string,
  touchedFiles: string[]
) => string[];

export function affectedAppNames(
  npmScope: string,
  projects: ProjectNode[],
  fileRead: (s: string) => string,
  touchedFiles: string[]
): string[] {
  return affectedProjects(npmScope, projects, fileRead, touchedFiles)
    .filter(p => p.type === ProjectType.app)
    .map(p => p.name);
}

export function affectedE2eNames(
  npmScope: string,
  projects: ProjectNode[],
  fileRead: (s: string) => string,
  touchedFiles: string[]
): string[] {
  return affectedProjects(npmScope, projects, fileRead, touchedFiles)
    .filter(p => p.type === ProjectType.e2e)
    .map(p => p.name);
}

export function affectedProjectNames(
  npmScope: string,
  projects: ProjectNode[],
  fileRead: (s: string) => string,
  touchedFiles: string[]
): string[] {
  return affectedProjects(npmScope, projects, fileRead, touchedFiles).map(
    p => p.name
  );
}

function hasDependencyOnTouchedProjects(
  project: string,
  touchedProjects: string[],
  deps: { [projectName: string]: Dependency[] },
  visisted: string[]
) {
  if (touchedProjects.indexOf(project) > -1) return true;
  if (visisted.indexOf(project) > -1) return false;
  return (
    deps[project]
      .map(d => d.projectName)
      .filter(k =>
        hasDependencyOnTouchedProjects(
          k,
          touchedProjects,
          deps,
          [...visisted, project]
        )
      ).length > 0
  );
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

export type Deps = { [projectName: string]: Dependency[] };

export function dependencies(
  npmScope: string,
  projects: ProjectNode[],
  fileRead: (s: string) => string
): Deps {
  return new DepsCalculator(npmScope, projects, fileRead).calculateDeps();
}

class DepsCalculator {
  private deps: Deps;

  constructor(
    private npmScope: string,
    private projects: ProjectNode[],
    private fileRead: (s: string) => string
  ) {
    this.projects.sort((a, b) => {
      if (!a.root) return -1;
      if (!b.root) return -1;
      return a.root.length > b.root.length ? -1 : 1;
    });
  }

  calculateDeps() {
    this.deps = this.projects.reduce((m, c) => ({ ...m, [c.name]: [] }), {});
    this.createImplicitDepsFromE2eToApps();
    this.processAllFiles();
    return this.deps;
    // return this.includeTransitive();
  }

  private createImplicitDepsFromE2eToApps() {
    this.projects.filter(p => p.type === ProjectType.e2e).forEach(e2e => {
      const appName = e2e.name.substring(0, e2e.name.length - 4);
      if (
        this.projects.find(
          a => a.name === appName && a.type === ProjectType.app
        )
      ) {
        this.deps[e2e.name] = [
          { projectName: appName, type: DependencyType.implicit }
        ];
      }
    });
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
      const tsFile = ts.createSourceFile(
        filePath,
        this.fileRead(filePath),
        ts.ScriptTarget.Latest,
        true
      );
      this.processNode(projectName, tsFile);
    }
  }

  private processNode(projectName: string, node: ts.Node): void {
    if (node.kind === ts.SyntaxKind.ImportDeclaration) {
      const imp = this.getStringLiteralValue(
        (node as ts.ImportDeclaration).moduleSpecifier
      );
      this.addDepIfNeeded(imp, projectName, DependencyType.es6Import);
      return; // stop traversing downwards
    }

    if (node.kind === ts.SyntaxKind.PropertyAssignment) {
      const name = this.getPropertyAssignmentName(
        (node as ts.PropertyAssignment).name
      );
      if (name === 'loadChildren') {
        const init = (node as ts.PropertyAssignment).initializer;
        if (init.kind === ts.SyntaxKind.StringLiteral) {
          const childrenExpr = this.getStringLiteralValue(init);
          this.addDepIfNeeded(
            childrenExpr,
            projectName,
            DependencyType.loadChildren
          );
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

  private addDepIfNeeded(
    expr: string,
    projectName: string,
    depType: DependencyType
  ) {
    const matchingProject = this.projects.filter(a => {
      const normalizedRoot = normalizedProjectRoot(a);
      return (
        expr === `@${this.npmScope}/${normalizedRoot}` ||
        expr.startsWith(`@${this.npmScope}/${normalizedRoot}#`) ||
        expr.startsWith(`@${this.npmScope}/${normalizedRoot}/`)
      );
    })[0];

    if (matchingProject) {
      const alreadyHasDep = this.deps[projectName].some(
        p => p.projectName === matchingProject.name && p.type === depType
      );
      const depOnSelf = projectName === matchingProject.name;
      if (!alreadyHasDep && !depOnSelf) {
        this.deps[projectName].push({
          projectName: matchingProject.name,
          type: depType
        });
      }
    }
  }

  private getStringLiteralValue(node: ts.Node): string {
    return node.getText().substr(1, node.getText().length - 2);
  }
}
