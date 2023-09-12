import { TempFs } from '../../../../utils/testing/temp-fs';
const tempFs = new TempFs('explicit-package-json');

import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';

import { ProjectGraphProjectNode } from '../../../../config/project-graph';
import { ProjectGraphBuilder } from '../../../../project-graph/project-graph-builder';
import { createProjectFileMap } from '../../../../project-graph/file-map-utils';
import { fileHasher } from '../../../../hasher/file-hasher';
import { CreateDependenciesContext } from '../../../../utils/nx-plugin';

describe('explicit package json dependencies', () => {
  let ctx: CreateDependenciesContext;
  let projects: Record<string, ProjectGraphProjectNode>;

  beforeEach(async () => {
    const projectsConfigurations = {
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

    const nxJsonConfiguration = {
      npmScope: 'proj',
    };

    await tempFs.createFiles({
      './package.json': `{
            "name": "test",
            "dependencies": [],
            "devDependencies": []
          }`,
      './nx.json': JSON.stringify(nxJsonConfiguration),
      './tsconfig.base.json': JSON.stringify({}),
      './libs/proj2/package.json': JSON.stringify({ name: 'proj2' }),
      './libs/proj3/package.json': JSON.stringify({ name: 'proj3' }),
      './libs/proj/package.json': JSON.stringify({
        dependencies: { proj2: '*', external: '12.0.0' },
        devDependencies: { proj3: '*' },
      }),
    });

    await fileHasher.init();

    projects = {
      proj: {
        name: 'proj',
        type: 'lib',
        data: {
          root: 'libs/proj',
        },
      },
      proj2: {
        name: 'proj2',
        type: 'lib',
        data: { root: 'libs/proj2' },
      },
      proj3: {
        name: 'proj3',
        type: 'lib',
        data: { root: 'libs/proj4' },
      },
    };

    const projectFileMap = createProjectFileMap(
      projectsConfigurations as any,
      fileHasher.allFileData()
    ).projectFileMap;

    const builder = new ProjectGraphBuilder(undefined, projectFileMap);
    Object.values(projects).forEach((p) => {
      builder.addNode(p);
    });
    builder.addExternalNode({
      type: 'npm',
      name: 'npm:external',
      data: {
        version: '12.0.0',
        packageName: 'external',
      },
    });

    ctx = {
      fileMap: projectFileMap,
      externalNodes: builder.getUpdatedProjectGraph().externalNodes,
      projects: projectsConfigurations.projects,
      nxJsonConfiguration,
      filesToProcess: projectFileMap,
      workspaceRoot: tempFs.tempDir,
    };
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  it(`should add dependencies for projects based on deps in package.json`, () => {
    const res = buildExplicitPackageJsonDependencies(ctx);

    expect(res).toEqual([
      {
        source: 'proj',
        target: 'proj2',
        sourceFile: 'libs/proj/package.json',
        type: 'static',
      },
      {
        sourceFile: 'libs/proj/package.json',
        source: 'proj',
        target: 'npm:external',
        type: 'static',
      },
      {
        source: 'proj',
        target: 'proj3',
        sourceFile: 'libs/proj/package.json',
        type: 'static',
      },
    ]);
  });
});
