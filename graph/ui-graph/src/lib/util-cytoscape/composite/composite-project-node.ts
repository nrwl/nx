import { CompositeNode } from './composite-node';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  type ProjectFileMap,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';
import cytoscape from 'cytoscape';

export class CompositeProjectNode {
  parent: CompositeNode | null = null;
  deps: ProjectGraphDependency[] = [];

  constructor(
    private project: ProjectGraphProjectNode,
    private fileMap: ProjectFileMap
  ) {}

  get id() {
    return this.project.name;
  }

  get isRoot() {
    return !this.parent;
  }

  getCytoscapeElementDef(
    compositeContext?: string
  ): cytoscape.ElementDefinition {
    return {
      group: 'nodes',
      data: {
        id: this.project.name,
        parent: compositeContext || this.parent?.id,
        root: this.project.data.root,
        isRoot: this.isRoot,
        elementType: 'project',
        tags: this.project.data.tags,
        type: this.project.type,
        compositeContext,
        files: (this.fileMap || {})[this.project.data.name] || [],
        description: this.project.data.description,
      },
      classes: this.getClasses(),
    };
  }

  private getClasses() {
    let classes = 'projectNode';

    if (this.isRoot) {
      classes += ' root';
    }

    return classes;
  }
}
