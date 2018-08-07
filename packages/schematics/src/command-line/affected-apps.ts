import * as ts from 'typescript';
import * as path from 'path';
import { normalizedProjectRoot, ImplicitDependencies } from './shared';

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
  implicitDependencies: string[];
};
export type Dependency = { projectName: string; type: DependencyType };

export type DepGraph = {
  projects: ProjectNode[];
  deps: { [projectName: string]: Dependency[] };
  npmScope: string;
};

function implicitlyTouchedProjects(
  implicitDependencies: ImplicitDependencies,
  touchedFiles: string[]
): string[] {
  return Array.from(
    Object.entries(implicitDependencies.files).reduce(
      (projectSet, [file, projectNames]) => {
        if (touchedFiles.includes(file)) {
          projectNames.forEach(projectName => {
            projectSet.add(projectName);
          });
        }
        return projectSet;
      },
      new Set<string>()
    )
  );
}

function directlyTouchedProjects(
  projects: ProjectNode[],
  touchedFiles: string[]
) {
  return projects
    .filter(project => {
      return touchedFiles.some(file => {
        return project.files.some(projectFile => {
          return file.endsWith(projectFile);
        });
      });
    })
    .map(project => project.name);
}

export function touchedProjects(
  implicitDependencies: ImplicitDependencies,
  projects: ProjectNode[],
  touchedFiles: string[]
): string[] {
  projects = normalizeProjects(projects);
  touchedFiles = normalizeFiles(touchedFiles);
  const itp = implicitlyTouchedProjects(implicitDependencies, touchedFiles);
  // Return if all projects were implicitly touched
  if (itp.length === projects.length) {
    return itp;
  }
  const dtp = directlyTouchedProjects(projects, touchedFiles);
  return projects
    .filter(project => itp.includes(project.name) || dtp.includes(project.name))
    .map(project => project.name);
}

function affectedProjects(
  npmScope: string,
  projects: ProjectNode[],
  implicitDependencies: ImplicitDependencies,
  fileRead: (s: string) => string,
  touchedFiles: string[]
): ProjectNode[] {
  projects = normalizeProjects(projects);
  const deps = dependencies(npmScope, projects, fileRead);
  const tp = touchedProjects(implicitDependencies, projects, touchedFiles);
  return projects.filter(proj =>
    hasDependencyOnTouchedProjects(proj.name, tp, deps, [])
  );
}

export type AffectedFetcher = (
  npmScope: string,
  projects: ProjectNode[],
  implicitDependencies: ImplicitDependencies,
  fileRead: (s: string) => string,
  touchedFiles: string[]
) => string[];

export function affectedAppNames(
  npmScope: string,
  projects: ProjectNode[],
  implicitDependencies: ImplicitDependencies,
  fileRead: (s: string) => string,
  touchedFiles: string[]
): string[] {
  return affectedProjects(
    npmScope,
    projects,
    implicitDependencies,
    fileRead,
    touchedFiles
  )
    .filter(p => p.type === ProjectType.app)
    .map(p => p.name);
}

export function affectedE2eNames(
  npmScope: string,
  projects: ProjectNode[],
  implicitDependencies: ImplicitDependencies,
  fileRead: (s: string) => string,
  touchedFiles: string[]
): string[] {
  return affectedProjects(
    npmScope,
    projects,
    implicitDependencies,
    fileRead,
    touchedFiles
  )
    .filter(p => p.type === ProjectType.e2e)
    .map(p => p.name);
}

export function affectedBuildableNames(
  npmScope: string,
  projects: ProjectNode[],
  implicitDependencies: ImplicitDependencies,
  fileRead: (s: string) => string,
  touchedFiles: string[]
): string[] {
  return affectedProjects(
    npmScope,
    projects,
    implicitDependencies,
    fileRead,
    touchedFiles
  )
    .filter(p => p.architect.build)
    .map(p => p.name);
}

export function affectedLibNames(
  npmScope: string,
  projects: ProjectNode[],
  implicitDependencies: ImplicitDependencies,
  fileRead: (s: string) => string,
  touchedFiles: string[]
): string[] {
  return affectedProjects(
    npmScope,
    projects,
    implicitDependencies,
    fileRead,
    touchedFiles
  )
    .filter(p => p.type === ProjectType.lib)
    .map(p => p.name);
}

export function affectedProjectNames(
  npmScope: string,
  projects: ProjectNode[],
  implicitDependencies: ImplicitDependencies,
  fileRead: (s: string) => string,
  touchedFiles: string[]
): string[] {
  return affectedProjects(
    npmScope,
    projects,
    implicitDependencies,
    fileRead,
    touchedFiles
  ).map(p => p.name);
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
    this.setImplicitDepsFromProjects(this.deps, this.projects);
    this.processAllFiles();
    return this.deps;
    // return this.includeTransitive();
  }

  private setImplicitDepsFromProjects(deps: Deps, projects: ProjectNode[]) {
    projects.forEach(project => {
      if (project.implicitDependencies.length === 0) {
        return;
      }

      project.implicitDependencies.forEach(depName => {
        this.setDependencyIfNotAlreadySet(
          deps,
          project.name,
          depName,
          DependencyType.implicit
        );
      });
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
      this.setDependencyIfNotAlreadySet(
        this.deps,
        projectName,
        matchingProject.name,
        depType
      );
    }
  }

  private setDependencyIfNotAlreadySet(
    deps: Deps,
    depSource: string,
    depTarget: string,
    depType: DependencyType
  ) {
    const alreadyHasDep = deps[depSource].some(
      p => p.projectName === depTarget && p.type === depType
    );
    const depOnSelf = depSource === depTarget;
    if (!alreadyHasDep && !depOnSelf) {
      const dep = { projectName: depTarget, type: depType };
      deps[depSource].push(dep);
    }
  }

  private getStringLiteralValue(node: ts.Node): string {
    return node.getText().substr(1, node.getText().length - 2);
  }
}
