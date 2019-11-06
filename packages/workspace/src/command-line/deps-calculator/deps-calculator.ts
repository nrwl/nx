import { writeToFile } from '../../utils/fileutils';

import {
  Dependency,
  DependencyType,
  Dependencies,
  NxDepsJson,
  PackageJson,
  ProjectNode
} from '../shared-models';
import { TypeScriptDependencyLocator } from './locate-dependency';

/**
 * Class for calculating dependencies between projects by processing files.
 */
export class DepsCalculator {
  public get incrementalEnabled(): boolean {
    return this._incremental;
  }

  private readonly _incremental: boolean;
  private readonly nxDeps: NxDepsJson;
  private readonly dependencyLocator: TypeScriptDependencyLocator;

  constructor(
    private npmScope: string,
    private projects: ProjectNode[],
    private existingDeps: NxDepsJson,
    private packageJson: PackageJson,
    private fileRead: (s: string) => string
  ) {
    this.projects.sort((a, b) => {
      if (!a.root) return -1;
      if (!b.root) return -1;
      return a.root.length > b.root.length ? -1 : 1;
    });
    this._incremental = this.shouldIncrementallyRecalculate();
    this.nxDeps = this.initializeDeps();
    this.dependencyLocator = new TypeScriptDependencyLocator(
      npmScope,
      projects,
      packageJson,
      fileRead
    );
  }

  /**
   * Write the current state of dependencies to a file
   * @param path Path of file to write to
   */
  commitDeps(path: string): void {
    this.nxDeps.dependencies = this.getDeps();
    const files = this.nxDeps.files;
    // This removes files with no dependencies from the cache because it doesn't matter.
    Object.entries(files).forEach(([key, val]) => {
      if (!val || val.length < 1) {
        delete files[key];
      }
    });
    writeToFile(
      path,
      JSON.stringify({
        ...this.nxDeps,
        files
      })
    );
  }

  /**
   * Retrieve the current dependencies
   */
  getDeps(): Dependencies {
    const dependencies = this.projects.reduce((deps, project) => {
      const dependencies = project.files
        .map(file => this.nxDeps.files[file] || [])
        .reduce((arr, deps) => {
          return [
            ...arr,
            ...deps.filter(
              dep => !arr.some(item => item.projectName === dep.projectName)
            )
          ];
        }, [])
        .filter(dep => dep.projectName !== project.name);
      deps[project.name] = dependencies;
      return deps;
    }, {});
    this.setImplicitDepsFromProjects(dependencies, this.projects);
    return dependencies;
  }

  /**
   * Process a file and update its dependencies
   */
  processFile(filePath: string): void {
    this.nxDeps.files[filePath] = []; // Reset all dependencies

    this.dependencyLocator.process(filePath, (dep: Dependency) => {
      this.setDependencyIfNotAlreadySet(this.nxDeps.files, filePath, dep);
    });
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

    const dependencies = this.projects.reduce((m, c) => {
      m[c.name] = [];
      return m;
    }, {});

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

  private setImplicitDepsFromProjects(
    deps: Dependencies,
    projects: ProjectNode[]
  ) {
    projects.forEach(project => {
      if (project.implicitDependencies.length === 0) {
        return;
      }

      project.implicitDependencies.forEach(depName => {
        this.setDependencyIfNotAlreadySet(deps, project.name, {
          projectName: depName,
          type: DependencyType.implicit
        });
      });
    });
  }

  private setDependencyIfNotAlreadySet(
    existingDeps: Dependencies,
    file: string,
    entry: Dependency
  ) {
    const alreadyHasDep = existingDeps[file].some(
      d => d.projectName === entry.projectName && d.type === entry.type
    );
    if (!alreadyHasDep) {
      existingDeps[file].push(entry);
    }
  }
}
