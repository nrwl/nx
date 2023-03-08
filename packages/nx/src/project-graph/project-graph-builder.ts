/**
 * Builder for adding nodes and dependencies to a {@link ProjectGraph}
 */
import {
  DependencyType,
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../config/project-graph';

export class ProjectGraphBuilder {
  // TODO(FrozenPandaz): make this private
  readonly graph: ProjectGraph;
  readonly removedEdges: { [source: string]: Set<string> } = {};

  constructor(g?: ProjectGraph) {
    if (g) {
      this.graph = g;
    } else {
      this.graph = {
        nodes: {},
        externalNodes: {},
        dependencies: {},
      };
    }
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
    if (this.graph.nodes[sourceProjectName] && !sourceProjectFile) {
      throw new Error(`Source project file is required`);
    }
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
    if (this.graph.externalNodes[sourceProjectName]) {
      throw new Error(`External projects can't have "dynamic" dependencies`);
    }
    if (!sourceProjectFile) {
      throw new Error(`Source project file is required`);
    }
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
    if (this.graph.externalNodes[sourceProjectName]) {
      throw new Error(`External projects can't have "implicit" dependencies`);
    }
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
    // this.graph.dependencies[sourceProjectName] = this.graph.dependencies[
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
    if (sourceProjectName === targetProjectName) {
      return;
    }
    const source = this.graph.nodes[sourceProjectName];
    if (!source) {
      throw new Error(`Source project does not exist: ${sourceProjectName}`);
    }

    if (
      !this.graph.nodes[targetProjectName] &&
      !this.graph.externalNodes[targetProjectName]
    ) {
      throw new Error(`Target project does not exist: ${targetProjectName}`);
    }

    const fileData = source.data.files.find(
      (f) => f.file === sourceProjectFile
    );
    if (!fileData) {
      throw new Error(
        `Source project ${sourceProjectName} does not have a file: ${sourceProjectFile}`
      );
    }

    if (!fileData.dependencies) {
      fileData.dependencies = [];
    }

    if (!fileData.dependencies.find((t) => t.target === targetProjectName)) {
      fileData.dependencies.push({
        target: targetProjectName,
        source: sourceProjectName,
        type: DependencyType.static,
      });
    }
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

  private addDependency(
    sourceProjectName: string,
    targetProjectName: string,
    type: DependencyType,
    sourceProjectFile?: string
  ): void {
    if (sourceProjectName === targetProjectName) {
      return;
    }
    if (
      !this.graph.nodes[sourceProjectName] &&
      !this.graph.externalNodes[sourceProjectName]
    ) {
      throw new Error(`Source project does not exist: ${sourceProjectName}`);
    }
    if (
      !this.graph.nodes[targetProjectName] &&
      !this.graph.externalNodes[targetProjectName]
    ) {
      throw new Error(`Target project does not exist: ${targetProjectName}`);
    }
    if (
      this.graph.externalNodes[sourceProjectName] &&
      this.graph.nodes[targetProjectName]
    ) {
      throw new Error(`External projects can't depend on internal projects`);
    }
    if (!this.graph.dependencies[sourceProjectName]) {
      this.graph.dependencies[sourceProjectName] = [];
    }
    const isDuplicate = !!this.graph.dependencies[sourceProjectName].find(
      (d) => d.target === targetProjectName && d.type === type
    );
    // do not add duplicate to project
    if (isDuplicate && !sourceProjectFile) {
      return;
    }

    const dependency = {
      source: sourceProjectName,
      target: targetProjectName,
      type,
    };

    if (sourceProjectFile) {
      const source = this.graph.nodes[sourceProjectName];
      if (!source) {
        throw new Error(
          `Source project is not a project node: ${sourceProjectName}`
        );
      }
      const fileData = source.data.files.find(
        (f) => f.file === sourceProjectFile
      );
      if (!fileData) {
        throw new Error(
          `Source project ${sourceProjectName} does not have a file: ${sourceProjectFile}`
        );
      }

      if (!fileData.dependencies) {
        fileData.dependencies = [];
      }
      if (!fileData.dependencies.find((t) => t.target === targetProjectName)) {
        fileData.dependencies.push(dependency);
      }
    }

    if (isDuplicate) {
      return;
    }

    this.graph.dependencies[sourceProjectName].push(dependency);
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
    const files = this.graph.nodes[sourceProject].data.files;
    if (!files) {
      return fileDeps;
    }
    for (let f of files) {
      if (f.dependencies) {
        for (let d of f.dependencies) {
          if (!fileDeps.has(d.target)) {
            fileDeps.set(d.target, new Set([d.type]));
          } else {
            fileDeps.get(d.target).add(d.type);
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
        if (!removed || !removed.has(d.target)) {
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
