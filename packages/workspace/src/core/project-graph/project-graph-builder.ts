import {
  DependencyType,
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphNode,
} from './project-graph-models';

export class ProjectGraphBuilder {
  readonly nodes: Record<string, ProjectGraphNode> = {};
  readonly dependencies: Record<
    string,
    Record<string, ProjectGraphDependency>
  > = {};

  constructor(g?: ProjectGraph) {
    if (g) {
      Object.values(g.nodes).forEach((n) => this.addNode(n));
      Object.values(g.dependencies).forEach((ds) => {
        ds.forEach((d) => this.addDependency(d.type, d.source, d.target));
      });
    }
  }

  addNode(node: ProjectGraphNode) {
    // Check if project with the same name already exists
    if (this.nodes[node.name]) {
      // Throw if existing project is of a different type
      if (this.nodes[node.name].type !== node.type) {
        throw new Error(
          `Multiple projects are named "${node.name}". One is of type "${
            node.type
          }" and the other is of type "${
            this.nodes[node.name].type
          }". Please resolve the conflicting project names.`
        );
      }
    }
    this.nodes[node.name] = node;
    this.dependencies[node.name] = {};
  }

  addDependency(
    type: DependencyType | string,
    sourceProjectName: string,
    targetProjectName: string
  ) {
    if (sourceProjectName === targetProjectName) {
      return;
    }
    if (!this.nodes[sourceProjectName]) {
      throw new Error(`Source project does not exist: ${sourceProjectName}`);
    }
    if (!this.nodes[targetProjectName]) {
      throw new Error(`Target project does not exist: ${targetProjectName}`);
    }
    this.dependencies[sourceProjectName][
      `${sourceProjectName} -> ${targetProjectName}`
    ] = {
      type,
      source: sourceProjectName,
      target: targetProjectName,
    };
  }

  build(): ProjectGraph {
    return {
      nodes: this.nodes as ProjectGraph['nodes'],
      dependencies: Object.keys(this.dependencies).reduce((acc, k) => {
        acc[k] = Object.values(this.dependencies[k]);
        return acc;
      }, {} as ProjectGraph['dependencies']),
    };
  }
}
