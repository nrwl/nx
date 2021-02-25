import { buildExplicitPackageJsonDependencies } from '@nrwl/workspace/src/core/project-graph/build-dependencies/explicit-package-json-dependencies';
import { fs, vol } from 'memfs';
import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNode,
} from '../project-graph-models';
import { createFileMap } from '../../file-graph';
import { readWorkspaceFiles } from '../../file-utils';
import { appRootPath } from '../../../utilities/app-root';

jest.mock('../../../utilities/app-root', () => ({
  appRootPath: '/root',
}));
jest.mock('fs', () => require('memfs').fs);

describe('explicit package json dependencies', () => {
  let ctx: ProjectGraphContext;
  let projects: Record<string, ProjectGraphNode>;
  let fsJson;
  beforeEach(() => {
    const workspaceJson = {
      projects: {
        proj: {
          root: 'libs/proj',
        },
        proj2: {
          root: 'libs/proj2',
        },
        proj3: {
          root: 'libs/proj3',
        },
        proj4: {
          root: 'libs/proj4',
        },
      },
    };

    const nxJson = {
      npmScope: 'proj',
      projects: {
        proj1: {},
      },
    };

    fsJson = {
      './package.json': `{
        "name": "test",
        "dependencies": [],
        "devDependencies": []
      }`,
      './workspace.json': JSON.stringify(workspaceJson),
      './nx.json': JSON.stringify(nxJson),
      './tsconfig.base.json': JSON.stringify({}),
      './libs/proj/package.json': JSON.stringify({
        dependencies: { proj2: '*' },
        devDependencies: { proj3: '*' },
      }),
    };
    vol.fromJSON(fsJson, '/root');

    ctx = {
      workspaceJson,
      nxJson,
      fileMap: createFileMap(workspaceJson, readWorkspaceFiles()),
    };

    projects = {
      proj: {
        name: 'proj',
        type: 'lib',
        data: {
          root: 'libs/proj',
          files: [{ file: 'libs/proj/package.json' } as any],
        },
      },
      proj2: {
        name: 'proj2',
        type: 'lib',
        data: { files: [] },
      },
      proj3: {
        name: 'proj3',
        type: 'lib',
        data: { files: [] },
      },
    };
  });

  it(`should add dependencies for projects based on deps in package.json`, () => {
    const dependencyMap = {};
    const addDependency = jest
      .fn<ReturnType<AddProjectDependency>, Parameters<AddProjectDependency>>()
      .mockImplementation(
        (type: DependencyType, source: string, target: string) => {
          const depObj = {
            type,
            source,
            target,
          };
          if (dependencyMap[source]) {
            dependencyMap[source].push(depObj);
          } else {
            dependencyMap[source] = [depObj];
          }
        }
      );

    buildExplicitPackageJsonDependencies(ctx, projects, addDependency, (s) => {
      return fs.readFileSync(`${appRootPath}/${s}`).toString();
    });

    expect(dependencyMap).toEqual({
      proj: [
        {
          source: 'proj',
          target: 'proj2',
          type: DependencyType.static,
        },
        {
          source: 'proj',
          target: 'proj3',
          type: DependencyType.static,
        },
      ],
    });
  });
});
