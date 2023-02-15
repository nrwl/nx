import { TempFs } from '../../../../utils/testing/temp-fs';
const tempFs = new TempFs('explicit-package-json');

import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';

import { defaultFileHasher } from '../../../../hasher/file-hasher';
import {
  ProjectGraphProcessorContext,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import { ProjectGraphBuilder } from '../../../../project-graph/project-graph-builder';
import { createProjectFileMap } from '../../../../project-graph/file-map-utils';

describe('explicit package json dependencies', () => {
  let ctx: ProjectGraphProcessorContext;
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

    await defaultFileHasher.init();

    ctx = {
      projectsConfigurations,
      nxJsonConfiguration,
      filesToProcess: createProjectFileMap(
        projectsConfigurations as any,
        defaultFileHasher.allFileData()
      ).projectFileMap,
    } as any;

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
        data: { root: 'libs/proj2', files: [] },
      },
      proj3: {
        name: 'proj3',
        type: 'lib',
        data: { root: 'libs/proj4', files: [] },
      },
    };
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  it(`should add dependencies for projects based on deps in package.json`, () => {
    const builder = new ProjectGraphBuilder();
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

    const res = buildExplicitPackageJsonDependencies(
      ctx.nxJsonConfiguration,
      ctx.projectsConfigurations,
      builder.graph,
      ctx.filesToProcess
    );

    expect(res).toEqual([
      {
        sourceProjectName: 'proj',
        targetProjectName: 'proj2',
        sourceProjectFile: 'libs/proj/package.json',
        type: 'static',
      },
      {
        sourceProjectFile: 'libs/proj/package.json',
        sourceProjectName: 'proj',
        targetProjectName: 'npm:external',
        type: 'static',
      },
      {
        sourceProjectName: 'proj',
        targetProjectName: 'proj3',
        sourceProjectFile: 'libs/proj/package.json',
        type: 'static',
      },
    ]);
  });
});
