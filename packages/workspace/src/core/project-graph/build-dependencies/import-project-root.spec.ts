import { buildImportsToProjectRoots } from './import-project-root';
import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNode
} from '../../project-graph';

import { fs, vol } from 'memfs';
import { join } from 'path';

describe('buildImportsToProjectRoots', () => {
  let addDependency: AddProjectDependency;
  let ctx: ProjectGraphContext;
  let projects: Record<string, ProjectGraphNode>;
  let fileRead: (path: string) => string;
  let fsJson;
  beforeEach(() => {
    addDependency = jest.fn();
    fileRead = p => fs.readFileSync(join('/root', p)).toString();
    const workspaceJson = {
      projects: {
        proj1: {}
      }
    };
    const nxJson = {
      npmScope: 'proj',
      projects: {
        proj1: {}
      }
    };
    fsJson = {
      'workspace.json': JSON.stringify(workspaceJson),
      'nx.json': JSON.stringify(nxJson),
      'libs/proj1/index.ts': `import '@proj/proj2';
                              import('@proj/proj3');
                              const a = { loadChildren: '@proj/proj4#a' };`,
      'libs/proj2/index.ts': `export const a = 0;`,
      'libs/proj3/index.ts': `export const a = 0;`,
      'libs/proj4/index.ts': `export const a = 0;`
    };
    vol.fromJSON(fsJson, '/root');

    ctx = {
      workspaceJson,
      nxJson,
      fileMap: {
        proj1: [
          {
            file: 'libs/proj1/index.ts',
            mtime: 0,
            ext: '.ts'
          }
        ],
        proj2: [
          {
            file: 'libs/proj2/index.ts',
            mtime: 0,
            ext: '.ts'
          }
        ],
        proj3: [
          {
            file: 'libs/proj3/index.ts',
            mtime: 0,
            ext: '.ts'
          }
        ],
        proj4: [
          {
            file: 'libs/proj4/index.ts',
            mtime: 0,
            ext: '.ts'
          }
        ]
      }
    };
    projects = {
      proj1: {
        name: 'proj1',
        type: 'lib',
        data: {
          root: 'libs/proj1',
          files: []
        }
      },
      proj2: {
        name: 'proj2',
        type: 'lib',
        data: {
          root: 'libs/proj2',
          files: []
        }
      },
      proj3: {
        name: 'proj3',
        type: 'lib',
        data: {
          root: 'libs/proj3',
          files: []
        }
      },
      proj4: {
        name: 'proj4',
        type: 'lib',
        data: {
          root: 'libs/proj4',
          files: []
        }
      }
    };
  });

  it('should draw static dependencies from imports', () => {
    buildImportsToProjectRoots(ctx, projects, addDependency, fileRead);

    expect(addDependency).toHaveBeenCalledWith(
      DependencyType.static,
      'proj1',
      'proj2'
    );
  });

  it('should draw dynamic dependencies from import()', () => {
    buildImportsToProjectRoots(ctx, projects, addDependency, fileRead);

    expect(addDependency).toHaveBeenCalledWith(
      DependencyType.dynamic,
      'proj1',
      'proj3'
    );
  });

  it('should draw dynamic dependencies from loadChildren', () => {
    buildImportsToProjectRoots(ctx, projects, addDependency, fileRead);

    expect(addDependency).toHaveBeenCalledWith(
      DependencyType.dynamic,
      'proj1',
      'proj4'
    );
  });
});
