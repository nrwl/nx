import { CompositeProjectNode } from './composite-project-node';
import cytoscape from 'cytoscape';

export interface CompositeNodeDataDefinition
  extends cytoscape.NodeDataDefinition {
  id: string;
  label: string;
  expanded: boolean;
  projectCount: number;
  compositeCount: number;
}

export class CompositeNode {
  projects: CompositeProjectNode[] = [];
  parent: CompositeNode | null = null;
  composites: Set<CompositeNode> = new Set();

  constructor(public label: string) {}

  get id() {
    return `composite-${this.label}`;
  }

  getCytoscapeElementDef(
    compositeContext?: string
  ): cytoscape.ElementDefinition {
    return {
      group: 'nodes',
      data: {
        id: this.id,
        label: `${this.label} (${this.projects.length + this.composites.size})`,
        projectCount: this.projects.length,
        composites: this.getCompositesArray(),
        parent: compositeContext || this.parent?.id,
        size: this.projects.length,
        hidden: !compositeContext && !!this.parent,
        elementType: 'composite',
        compositeContext: compositeContext || null,
      },
      classes: this.getClasses(compositeContext),
    };
  }

  private getClasses(compositeContext?: string) {
    let classes = `composite`;

    if (compositeContext) {
      classes += ` withinContext`;
    }

    return classes;
  }

  private getCompositesArray() {
    if (this.composites.size) {
      return Array.from(this.composites.values()).map(
        (composite) => composite.label
      );
    }
    return null;
  }
}
