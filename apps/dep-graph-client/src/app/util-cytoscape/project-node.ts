import { ProjectGraphNode } from '@nrwl/workspace';
import * as cy from 'cytoscape';

interface NodeDataDefinition extends cy.NodeDataDefinition {
  id: string;
  type: string;
  tags: string[];
}

export class ProjectNode {
  affected = false;
  focused = false;

  constructor(private project: ProjectGraphNode) {}

  getCytoscapeNodeDef(groupByFolder: boolean): cy.NodeDefinition {
    return {
      group: 'nodes',
      data: this.getData(groupByFolder),
      classes: this.getClasses(),
      selectable: false,
      grabbable: false,
      pannable: true,
    };
  }

  private getData(groupByFolder: boolean): NodeDataDefinition {
    return {
      id: this.project.name,
      type: this.project.type,
      tags: this.project.data.tags,
      parent:
        groupByFolder && this.project.data.hasOwnProperty('sourceRoot')
          ? this.getParentId(this.project.data.sourceRoot)
          : null,
    };
  }

  private getClasses(): string {
    let classes = this.project.type ? this.project.type : '';

    if (this.focused) {
      classes += ' focused';
    }

    if (this.affected) {
      classes += ' affected';
    }

    return classes;
  }

  private getParentId(sourceRoot: string): string | null {
    const split = sourceRoot.split('/');
    let directories = split.slice(1, -2);

    if (directories.length > 0) {
      let directory = directories.join('/');
      return `dir-${directory}`;
    }

    return null;
  }

  private getGrandParentId(sourceRoot: string): string | null {
    const split = sourceRoot.split('/');
    let directories = split.slice(1, -3);

    if (directories.length > 0) {
      let directory = directories.join('/');
      return `dir-${directory}`;
    }

    return null;
  }

  public getAncestors(): { id: string; parentId: string; label: string }[] {
    if (!this.project.data.sourceRoot) {
      return [];
    }
    const split = this.project.data.sourceRoot.split('/');
    let directories = split.slice(1, -2);

    if (directories.length > 0) {
      const ancestors: { id: string; parentId: string; label: string }[] = [
        {
          label: directories.join('/'),
          id: this.getParentId(this.project.data.sourceRoot),
          parentId: this.getGrandParentId(this.project.data.sourceRoot),
        },
      ];

      while (directories.length > 1) {
        const sourceRoot = directories.join('/');
        const parentData = {
          id: this.getParentId(sourceRoot),
          parentId: this.getGrandParentId(this.project.data.sourceRoot),
          label: sourceRoot,
        };
        ancestors.push(parentData);

        const split = sourceRoot.split('/');
        directories = split.slice(0, -1);
      }

      return ancestors;
    } else {
      return [];
    }
  }
}
