// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nrwl/devkit';
import * as cy from 'cytoscape';
import { parseParentDirectoriesFromFilePath } from '../util';

interface NodeDataDefinition extends cy.NodeDataDefinition {
  id: string;
  type: string;
  tags: string[];
}

interface Ancestor {
  id: string;
  parentId: string;
  label: string;
}

export class ProjectNode {
  affected = false;
  focused = false;

  constructor(
    private project: ProjectGraphProjectNode,
    private workspaceRoot: string
  ) {}

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
        groupByFolder && this.project.data.hasOwnProperty('root')
          ? this.getParentId()
          : null,
      files: this.project.data.files,
      root: this.project.data.root,
    };
  }

  private getClasses(): string {
    let classes = this.project.type ?? '';

    if (this.affected) {
      classes += ' affected';
    }

    return classes;
  }

  private getParentId(): string | null {
    const ancestors = this.getAncestors();

    if (ancestors.length > 0) {
      return ancestors[ancestors.length - 1].id;
    } else {
      return null;
    }
  }

  public getAncestors(): Ancestor[] {
    // if there's no root, we can't figure out the parent
    if (!this.project.data.root) {
      return [];
    }

    const directories = parseParentDirectoriesFromFilePath(
      this.project.data.root,
      this.workspaceRoot
    );

    return directories.map((directory, index, allDirectories) => {
      const label = [...allDirectories].slice(0, index + 1).join('/');
      const id = `dir-${label}`;
      const parentId =
        index > 0
          ? `dir-${[...allDirectories].slice(0, index).join('/')}`
          : null;
      return {
        label,
        id,
        parentId,
      };
    });
  }
}
