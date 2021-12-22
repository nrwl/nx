import type {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphExternalNode,
  ProjectGraphNode,
} from './interfaces';
import { DependencyType } from './interfaces';

/**
 * Builder for adding nodes and dependencies to a {@link ProjectGraph}
 */
export class ProjectGraphBuilder {
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
  addNode(node: ProjectGraphNode): void {
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
    this.graph.dependencies[node.name] = [];
  }

  /**
   * Adds a external node to the project graph
   */
  addExternalNode(node: ProjectGraphExternalNode): void {
    this.graph.externalNodes[node.name] = node;
  }

  /**
   * Adds a dependency from source project to target project
   */
  addImplicitDependency(
    sourceProjectName: string,
    targetProjectName: string
  ): void {
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
    this.graph.dependencies[sourceProjectName].push({
      source: sourceProjectName,
      target: targetProjectName,
      type: DependencyType.implicit,
    });
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

    if (!fileData.deps) {
      fileData.deps = [];
    }

    if (!fileData.deps.find((t) => t === targetProjectName)) {
      fileData.deps.push(targetProjectName);
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
      ];

      const fileDeps = this.calculateTargetDepsFromFiles(sourceProject);
      for (const targetProject of fileDeps) {
        if (!alreadySetTargetProjects.has(targetProject)) {
          if (
            !this.removedEdges[sourceProject] ||
            !this.removedEdges[sourceProject].has(targetProject)
          ) {
            this.graph.dependencies[sourceProject].push({
              source: sourceProject,
              target: targetProject,
              type: DependencyType.static,
            });
          }
        }
      }
    }
    return this.graph;
  }

  private calculateTargetDepsFromFiles(sourceProject: string) {
    const fileDeps = new Set<string>();
    const files = this.graph.nodes[sourceProject].data.files;
    if (!files) return fileDeps;
    for (let f of files) {
      if (f.deps) {
        for (let p of f.deps) {
          fileDeps.add(p);
        }
      }
    }
    return fileDeps;
  }

  private calculateAlreadySetTargetDeps(sourceProject: string) {
    const alreadySetTargetProjects = new Map<string, ProjectGraphDependency>();
    const removed = this.removedEdges[sourceProject];
    for (const d of this.graph.dependencies[sourceProject]) {
      if (!removed || !removed.has(d.target)) {
        alreadySetTargetProjects.set(d.target, d);
      }
    }
    return alreadySetTargetProjects;
  }
}
