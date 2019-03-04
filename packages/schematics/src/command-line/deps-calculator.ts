import * as path from 'path';
import * as ts from 'typescript';
import * as appRoot from 'app-root-path';

import {
  normalizedProjectRoot,
  getProjectMTime,
  mtime,
  lastModifiedAmongProjectFiles
} from './shared';
import { ProjectNode } from './affected-apps';
import { mkdirSync, readFileSync } from 'fs';
import {
  fileExists,
  readJsonFile,
  directoryExists,
  writeToFile
} from '../utils/fileutils';

export type DepGraph = {
  projects: ProjectNode[];
  deps: Deps;
};
export type NxDepsJson = {
  dependencies: Deps;
  files: FileDeps;
};
export type Deps = {
  [projectName: string]: Dependency[];
};
export type FileDeps = {
  [filePath: string]: Dependency[];
};
export type Dependency = { projectName: string; type: DependencyType };

export enum DependencyType {
  es6Import = 'es6Import',
  loadChildren = 'loadChildren',
  implicit = 'implicit'
}

export function readDependencies(
  npmScope: string,
  projectNodes: ProjectNode[]
): Deps {
  const nxDepsPath = `${appRoot.path}/dist/nxdeps.json`;
  const m = lastModifiedAmongProjectFiles(projectNodes);
  if (!directoryExists(`${appRoot.path}/dist`)) {
    mkdirSync(`${appRoot.path}/dist`);
  }
  const existingDeps = fileExists(nxDepsPath) ? readJsonFile(nxDepsPath) : null;
  if (!existingDeps || m > mtime(nxDepsPath)) {
    return dependencies(npmScope, projectNodes, existingDeps, (f: string) =>
      readFileSync(`${appRoot.path}/${f}`, 'UTF-8')
    );
  } else {
    return existingDeps.dependencies;
  }
}

/**
 * DO NOT USE
 * Only exported for unit testing
 *
 * USE `readDependencies`
 */
export function dependencies(
  npmScope: string,
  projects: ProjectNode[],
  existingDependencies: NxDepsJson | null,
  fileRead: (s: string) => string
): Deps {
  const nxDepsPath = `${appRoot.path}/dist/nxdeps.json`;
  const nxDepsExists = fileExists(nxDepsPath);
  const nxDepsMTime = nxDepsExists ? mtime(nxDepsPath) : -Infinity;
  const calculator = new DepsCalculator(
    npmScope,
    projects,
    existingDependencies,
    fileRead
  );
  projects
    .filter(
      project =>
        !calculator.incrementalEnabled ||
        getProjectMTime(project) >= nxDepsMTime
    )
    .forEach(project => {
      project.files
        .filter(
          file =>
            !calculator.incrementalEnabled ||
            !project.fileMTimes[file] ||
            project.fileMTimes[file] >= nxDepsMTime
        )
        .forEach(file => {
          calculator.processFile(file);
        });
    });
  calculator.commitDeps(nxDepsPath);
  return calculator.getDeps();
}

/**
 * Class for calculating dependencies between projects by processing files.
 */
export class DepsCalculator {
  public get incrementalEnabled(): boolean {
    return this._incremental;
  }

  private _incremental: boolean;
  private deps: NxDepsJson;

  constructor(
    private npmScope: string,
    private projects: ProjectNode[],
    private existingDeps: NxDepsJson,
    private fileRead: (s: string) => string
  ) {
    this.projects.sort((a, b) => {
      if (!a.root) return -1;
      if (!b.root) return -1;
      return a.root.length > b.root.length ? -1 : 1;
    });
    this._incremental = this.shouldIncrementallyRecalculate();
    this.deps = this.initializeDeps();
  }

  /**
   * Write the current state of dependencies to a file
   * @param path Path of file to write to
   */
  commitDeps(path: string): void {
    this.deps.dependencies = this.getDeps();
    const files = this.deps.files;
    // This removes files with no dependencies from the cache because it doesn't matter.
    Object.entries(files).forEach(([key, val]) => {
      if (!val || val.length < 1) {
        delete files[key];
      }
    });
    writeToFile(
      path,
      JSON.stringify({
        ...this.deps,
        files
      })
    );
  }

  /**
   * Retrieve the current dependencies
   */
  getDeps(): Deps {
    const dependencies = this.projects.reduce((deps, project) => {
      const dependencies = project.files
        .map(file => this.deps.files[file] || [])
        .reduce((arr, deps) => {
          return [
            ...arr,
            ...deps.filter(
              dep => !arr.some(item => item.projectName === dep.projectName)
            )
          ];
        }, [])
        .filter(dep => dep.projectName !== project.name);
      return {
        ...deps,
        [project.name]: dependencies
      };
    }, {});
    this.setImplicitDepsFromProjects(dependencies, this.projects);
    return dependencies;
  }

  /**
   * Process a file and update it's dependencies
   */
  processFile(filePath: string): void {
    const extension = path.extname(filePath);
    if (
      extension !== '.ts' &&
      extension !== '.tsx' &&
      extension !== '.js' &&
      extension !== '.jsx'
    ) {
      return;
    }
    const tsFile = ts.createSourceFile(
      filePath,
      this.fileRead(filePath),
      ts.ScriptTarget.Latest,
      true
    );
    this.deps.files[filePath] = [];
    this.processNode(filePath, tsFile);
  }

  private isLegacyFormat(existingDeps: any): boolean {
    return !existingDeps.dependencies && !existingDeps.files;
  }

  private shouldIncrementallyRecalculate(): boolean {
    if (!this.existingDeps || this.isLegacyFormat(this.existingDeps)) {
      return false;
    }
    const currentProjects = this.projects.map(p => p.name).sort();
    const previousProjects = Object.keys(this.existingDeps.dependencies).sort();
    return (
      currentProjects.length === previousProjects.length &&
      !currentProjects.some((val, index) => val !== previousProjects[index])
    );
  }

  private initializeDeps(): NxDepsJson {
    const files = [];
    this.projects.forEach(p => {
      files.push(...p.files);
    });

    const dependencies = this.projects.reduce(
      (m, c) => ({ ...m, [c.name]: [] }),
      {}
    );

    const fileDependencies = {} as any;

    files.forEach(file => {
      fileDependencies[file] = this.incrementalEnabled
        ? this.existingDeps.files[file] || []
        : [];
    });

    return {
      dependencies,
      files: fileDependencies
    };
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

  private processNode(filePath: string, node: ts.Node): void {
    if (node.kind === ts.SyntaxKind.ImportDeclaration) {
      const imp = this.getStringLiteralValue(
        (node as ts.ImportDeclaration).moduleSpecifier
      );
      this.addDepIfNeeded(imp, filePath, DependencyType.es6Import);
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
            filePath,
            DependencyType.loadChildren
          );
          return; // stop traversing downwards
        }
      }
    }
    /**
     * Continue traversing down the AST from the current node
     */
    ts.forEachChild(node, child => this.processNode(filePath, child));
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
    filePath: string,
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
        this.deps.files,
        filePath,
        matchingProject.name,
        depType
      );
    }
  }

  private setDependencyIfNotAlreadySet(
    deps: Deps,
    key: string,
    depTarget: string,
    depType: DependencyType
  ) {
    const alreadyHasDep = deps[key].some(
      d => d.projectName === depTarget && d.type === depType
    );
    if (!alreadyHasDep) {
      const dep = { projectName: depTarget, type: depType };
      deps[key].push(dep);
    }
  }

  private getStringLiteralValue(node: ts.Node): string {
    return node.getText().substr(1, node.getText().length - 2);
  }
}
