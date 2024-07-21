import { CompositeProjectNode } from './composite-project-node';
import { CompositeNode } from './composite-node';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { ProjectGraphDependency } from 'nx/src/config/project-graph';
import cytoscape from 'cytoscape';

export type NodeForEdge = CompositeProjectNode | CompositeNode;
type EdgeType = 'projectEdge' | 'compositeEdge';

export class CompositeProjectEdge {
  constructor(
    public id: string,
    public dependency: ProjectGraphDependency,
    public source: NodeForEdge,
    public target: NodeForEdge,
    public deps: Set<string> = new Set()
  ) {}

  get type(): EdgeType {
    return this.deps.size > 0 ? 'compositeEdge' : 'projectEdge';
  }

  getCytoscapeElementDef(): cytoscape.ElementDefinition {
    return {
      group: 'edges',
      data: {
        id: this.id,
        source: this.getSourceNodeId(), // Determine source based on edge type
        target: this.target.id,
        type: this.dependency.type,
        depsCount: this.deps.size, // Include for composite edges
        label: this.deps.size,
      },
      classes: this.type === 'compositeEdge' ? 'compositeEdge' : '',
    };
  }

  private getSourceNodeId(): string {
    if (this.type === 'projectEdge') {
      let parent: NodeForEdge | null = this.source.parent;
      while (parent && !!parent.parent) {
        parent = parent.parent;
      }
      return parent?.id || this.source.id; // Handle root projects
    }

    return this.source.id;
  }
}
