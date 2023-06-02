/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectFileMap, ProjectGraphProjectNode } from '@nx/devkit';
/* eslint-enable @nx/enforce-module-boundaries */
import * as cy from 'cytoscape';
import { parseParentDirectoriesFromFilePath } from '../util';

export interface ProjectNodeDataDefinition extends cy.NodeDataDefinition {
  id: string;
  type: 'app' | 'lib' | 'e2e';
  tags: string[];

  description?: string;
}

export interface Ancestor {
  id: string;
  parentId: string;
  label: string;
}

export class ProjectNode {
  affected = false;
  focused = false;

  constructor(
    private fileMap: ProjectFileMap,
    private project: ProjectGraphProjectNode,
    private workspaceRoot: string
  ) {}

  getCytoscapeNodeDef(
    groupByFolder: boolean
  ): cy.NodeDefinition & { pannable: boolean } {
    return {
      group: 'nodes',
      data: this.getData(groupByFolder),
      classes: this.getClasses(),
      selectable: false,
      grabbable: false,
      pannable: true,
    };
  }

  private getData(groupByFolder: boolean): ProjectNodeDataDefinition {
    return {
      id: this.project.name,
      type: this.project.type,
      tags: this.project.data.tags,
      parent:
        groupByFolder && this.project.data.hasOwnProperty('root')
          ? this.getParentId()
          : null,
      files: (this.fileMap || {})[this.project.data.name] || [],
      root: this.project.data.root,
      description: this.project.data.description,
    };
  }

  private getClasses(): string {
    let classes = `projectNode ${this.project.type}`;

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
