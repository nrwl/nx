/**
 * Builder for adding nodes and dependencies to a {@link ProjectGraph}
 */
import {
  DependencyType,
  fileDataDepTarget,
  fileDataDepType,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../config/project-graph';
import { getProjectFileMap } from './build-project-graph';

/**
 * A class which builds up a project graph
 * @deprecated The {@link ProjectGraphProcessor} has been deprecated. Use a {@link CreateNodes} and/or a {@link CreateDependencies} instead. This will be removed in Nx 18.
 */
export class ProjectGraphBuilder {
  // TODO(FrozenPandaz): make this private
  readonly graph: ProjectGraph;
  private readonly fileMap: ProjectFileMap;
  readonly removedEdges: { [source: string]: Set<string> } = {};
  constructor(graph?: ProjectGraph, fileMap?: ProjectFileMap) {
    if (graph) {
      this.graph = graph;
      this.fileMap = fileMap || getProjectFileMap().projectFileMap;
    } else {
      this.graph = {
        nodes: {},
        externalNodes: {},
        dependencies: {},
      };
      this.fileMap = fileMap || {};
    }
  }

  /**
   * Merges the nodes and dependencies of p into the built project graph.
   */
  mergeProjectGraph(p: ProjectGraph) {
    this.graph.nodes = { ...this.graph.nodes, ...p.nodes };
    this.graph.externalNodes = {
      ...this.graph.externalNodes,
      ...p.externalNodes,
    };
    this.graph.dependencies = { ...this.graph.dependencies, ...p.dependencies };
  }

  /**
   * Adds a project node to the project graph
   */
  addNode(node: ProjectGraphProjectNode): void {
    // Check if project with the same name already exists
    if (this.graph.nodes[node.name]) {
      // Throw if existing project is of a different type
      if (this.graph.nodes[node.name].type !== node.type) {
        throw new Error(
          `Multiple projects are named "${node.name}". One is of type "${
            node.type
          }" and the other is of type "${
            this.graph.nodes[node.name].type
          }". Please resolve the conflicting project names.`
        );
      }
    }
    this.graph.nodes[node.name] = node;
  }

  /**
   * Removes a node and all of its dependency edges from the graph
   */
  removeNode(name: string) {
    if (!this.graph.nodes[name] && !this.graph.externalNodes[name]) {
      throw new Error(`There is no node named: "${name}"`);
    }

    this.removeDependenciesWithNode(name);

    if (this.graph.nodes[name]) {
      delete this.graph.nodes[name];
    } else {
      delete this.graph.externalNodes[name];
    }
  }

  /**
   * Adds a external node to the project graph
   */
  addExternalNode(node: ProjectGraphExternalNode): void {
    // Check if project with the same name already exists
    if (this.graph.externalNodes[node.name]) {
      throw new Error(
        `Multiple projects are named "${node.name}". One has version "${
          node.data.version
        }" and the other has version "${
          this.graph.externalNodes[node.name].data.version
        }". Please resolve the conflicting package names.`
      );
    }
    this.graph.externalNodes[node.name] = node;
  }

  /**
   * Adds static dependency from source project to target project
   */
  addStaticDependency(
    sourceProjectName: string,
    targetProjectName: string,
    sourceProjectFile?: string
  ): void {
    this.addDependency(
      sourceProjectName,
      targetProjectName,
      DependencyType.static,
      sourceProjectFile
    );
  }

  /**
   * Adds dynamic dependency from source project to target project
   */
  addDynamicDependency(
    sourceProjectName: string,
    targetProjectName: string,
    sourceProjectFile: string
  ): void {
    this.addDependency(
      sourceProjectName,
      targetProjectName,
      DependencyType.dynamic,
      sourceProjectFile
    );
  }

  /**
   * Adds implicit dependency from source project to target project
   */
  addImplicitDependency(
    sourceProjectName: string,
    targetProjectName: string
  ): void {
    this.addDependency(
      sourceProjectName,
      targetProjectName,
      DependencyType.implicit
    );
  }

  /**
   * Removes a dependency from source project to target project
   */
  removeDependency(sourceProjectName: string, targetProjectName: string): void {
    if (sourceProjectName === targetProjectName) {
      return;
    }
    if (!this.graph.nodes[sourceProjectName]) {
      throw new Error(`Source project does not exist: ${sourceProjectName}`);
    }
    if (
      !this.graph.nodes[targetProjectName] &&
      !this.graph.externalNodes[targetProjectName]
    ) {
      throw new Error(`Target project does not exist: ${targetProjectName}`);
    }
    // this._graph.dependencies[sourceProjectName] = this._graph.dependencies[
    //   sourceProjectName
    // ].filter((d) => d.target !== targetProjectName);
    if (!this.removedEdges[sourceProjectName]) {
      this.removedEdges[sourceProjectName] = new Set<string>();
    }
    this.removedEdges[sourceProjectName].add(targetProjectName);
  }

  /**
   * Add an explicit dependency from a file in source project to target project
   * @deprecated this method will be removed in v17. Use {@link addStaticDependency} or {@link addDynamicDependency} instead
   */
  addExplicitDependency(
    sourceProjectName: string,
    sourceProjectFile: string,
    targetProjectName: string
  ): void {
    this.addStaticDependency(
      sourceProjectName,
      targetProjectName,
      sourceProjectFile
    );
  }

  /**
   * Set version of the project graph
   */
  setVersion(version: string): void {
    this.graph.version = version;
  }

  getUpdatedProjectGraph(): ProjectGraph {
    for (const sourceProject of Object.keys(this.graph.nodes)) {
      const alreadySetTargetProjects =
        this.calculateAlreadySetTargetDeps(sourceProject);
      this.graph.dependencies[sourceProject] = [
        ...alreadySetTargetProjects.values(),
      ].flatMap((depsMap) => [...depsMap.values()]);

      const fileDeps = this.calculateTargetDepsFromFiles(sourceProject);
      for (const [targetProject, types] of fileDeps.entries()) {
        // only add known nodes
        if (
          !this.graph.nodes[targetProject] &&
          !this.graph.externalNodes[targetProject]
        ) {
          continue;
        }
        for (const type of types.values()) {
          if (
            !alreadySetTargetProjects.has(targetProject) ||
            !alreadySetTargetProjects.get(targetProject).has(type)
          ) {
            if (
              !this.removedEdges[sourceProject] ||
              !this.removedEdges[sourceProject].has(targetProject)
            ) {
              this.graph.dependencies[sourceProject].push({
                source: sourceProject,
                target: targetProject,
                type,
              });
            }
          }
        }
      }
    }
    return this.graph;
  }

  addDependency(
    source: string,
    target: string,
    type: DependencyType,
    sourceFile?: string
  ): void {
    if (source === target) {
      return;
    }

    validateDependency(this.graph, {
      source,
      target,
      dependencyType: type,
      sourceFile,
    });

    if (!this.graph.dependencies[source]) {
      this.graph.dependencies[source] = [];
    }
    const isDuplicate = !!this.graph.dependencies[source].find(
      (d) => d.target === target && d.type === type
    );

    if (sourceFile) {
      const sourceProject = this.graph.nodes[source];
      if (!sourceProject) {
        throw new Error(
          `Source project is not a project node: ${sourceProject}`
        );
      }
      const fileData = (this.fileMap[source] || []).find(
        (f) => f.file === sourceFile
      );
      if (!fileData) {
        throw new Error(
          `Source project ${source} does not have a file: ${sourceFile}`
        );
      }

      if (!fileData.deps) {
        fileData.deps = [];
      }
      if (
        !fileData.deps.find(
          (t) => fileDataDepTarget(t) === target && fileDataDepType(t) === type
        )
      ) {
        const dep: string | [string, string] =
          type === 'static' ? target : [target, type];
        fileData.deps.push(dep);
      }
    } else if (!isDuplicate) {
      // only add to dependencies section if the source file is not specified
      // and not already added
      this.graph.dependencies[source].push({
        source: source,
        target: target,
        type,
      });
    }
  }

  private removeDependenciesWithNode(name: string) {
    // remove all source dependencies
    delete this.graph.dependencies[name];

    // remove all target dependencies
    for (const dependencies of Object.values(this.graph.dependencies)) {
      for (const [index, { source, target }] of dependencies.entries()) {
        if (target === name) {
          const deps = this.graph.dependencies[source];
          this.graph.dependencies[source] = [
            ...deps.slice(0, index),
            ...deps.slice(index + 1),
          ];
          if (this.graph.dependencies[source].length === 0) {
            delete this.graph.dependencies[source];
          }
        }
      }
    }
  }

  private calculateTargetDepsFromFiles(
    sourceProject: string
  ): Map<string, Set<DependencyType | string>> {
    const fileDeps = new Map<string, Set<DependencyType | string>>();
    const files = this.fileMap?.[sourceProject] || [];
    if (!files) {
      return fileDeps;
    }
    for (let f of files) {
      if (f.deps) {
        for (let d of f.deps) {
          const target = fileDataDepTarget(d);
          if (!fileDeps.has(target)) {
            fileDeps.set(target, new Set([fileDataDepType(d)]));
          } else {
            fileDeps.get(target).add(fileDataDepType(d));
          }
        }
      }
    }
    return fileDeps;
  }

  private calculateAlreadySetTargetDeps(
    sourceProject: string
  ): Map<string, Map<DependencyType | string, ProjectGraphDependency>> {
    const alreadySetTargetProjects = new Map<
      string,
      Map<DependencyType | string, ProjectGraphDependency>
    >();
    if (this.graph.dependencies[sourceProject]) {
      const removed = this.removedEdges[sourceProject];
      for (const d of this.graph.dependencies[sourceProject]) {
        // static and dynamic dependencies of internal projects
        // will be rebuilt based on the file dependencies
        // we only need to keep the implicit dependencies
        if (d.type === DependencyType.implicit && !removed?.has(d.target)) {
          if (!alreadySetTargetProjects.has(d.target)) {
            alreadySetTargetProjects.set(d.target, new Map([[d.type, d]]));
          } else {
            alreadySetTargetProjects.get(d.target).set(d.type, d);
          }
        }
      }
    }
    return alreadySetTargetProjects;
  }
}

/**
 * A {@link ProjectGraph} dependency between 2 projects
 * Optional: Specifies a file from where the dependency is made
 */
export interface ProjectGraphDependencyWithFile {
  /**
   * The name of a {@link ProjectGraphProjectNode} or {@link ProjectGraphExternalNode} depending on the target project
   */
  source: string;
  /**
   * The name of a {@link ProjectGraphProjectNode} or {@link ProjectGraphExternalNode} that the source project depends on
   */
  target: string;
  /**
   * The path of a file (relative from the workspace root) where the dependency is made
   */
  sourceFile?: string;
  /**
   * The type of dependency
   */
  dependencyType: DependencyType;
}

/**
 * A function to validate dependencies in a {@link CreateDependencies} function
 * @throws If the dependency is invalid.
 */
export function validateDependency(
  graph: ProjectGraph,
  dependency: ProjectGraphDependencyWithFile
): void {
  if (dependency.dependencyType === DependencyType.implicit) {
    validateImplicitDependency(graph, dependency);
  } else if (dependency.dependencyType === DependencyType.dynamic) {
    validateDynamicDependency(graph, dependency);
  } else if (dependency.dependencyType === DependencyType.static) {
    validateStaticDependency(graph, dependency);
  }

  validateCommonDependencyRules(graph, dependency);
}

function validateCommonDependencyRules(
  graph: ProjectGraph,
  d: ProjectGraphDependencyWithFile
) {
  if (!graph.nodes[d.source] && !graph.externalNodes[d.source]) {
    throw new Error(`Source project does not exist: ${d.source}`);
  }
  if (
    !graph.nodes[d.target] &&
    !graph.externalNodes[d.target] &&
    !d.sourceFile
  ) {
    throw new Error(`Target project does not exist: ${d.target}`);
  }
  if (graph.externalNodes[d.source] && graph.nodes[d.target]) {
    throw new Error(`External projects can't depend on internal projects`);
  }
}

function validateImplicitDependency(
  graph: ProjectGraph,
  d: ProjectGraphDependencyWithFile
) {
  if (graph.externalNodes[d.source]) {
    throw new Error(`External projects can't have "implicit" dependencies`);
  }
}

function validateDynamicDependency(
  graph: ProjectGraph,
  d: ProjectGraphDependencyWithFile
) {
  if (graph.externalNodes[d.source]) {
    throw new Error(`External projects can't have "dynamic" dependencies`);
  }
  // dynamic dependency is always bound to a file
  if (!d.sourceFile) {
    throw new Error(
      `Source project file is required for "dynamic" dependencies`
    );
  }
}

function validateStaticDependency(
  graph: ProjectGraph,
  d: ProjectGraphDependencyWithFile
) {
  // internal nodes must provide sourceProjectFile when creating static dependency
  // externalNodes do not have sourceProjectFile
  if (graph.nodes[d.source] && !d.sourceFile) {
    throw new Error(`Source project file is required`);
  }
}
