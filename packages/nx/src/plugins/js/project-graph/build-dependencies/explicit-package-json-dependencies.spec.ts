import { TempFs } from '../../../../internal-testing-utils/temp-fs';
const tempFs = new TempFs('explicit-package-json');

import { ProjectGraphProjectNode } from '../../../../config/project-graph';
import { createFileMap } from '../../../../project-graph/file-map-utils';
import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import { ProjectGraphBuilder } from '../../../../project-graph/project-graph-builder';
import { getAllFileDataInContext } from '../../../../utils/workspace-context';

import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';
import { TargetProjectLocator } from './target-project-locator';

describe('explicit package json dependencies', () => {
  let ctx: CreateDependenciesContext;
  let projects: Record<string, ProjectGraphProjectNode>;

  beforeEach(async () => {
    const projectsConfigurations = {
      projects: {
        proj: {
          root: 'libs/proj',
          name: 'proj',
        },
        proj2: {
          root: 'libs/proj2',
          name: 'proj2',
        },
        proj3: {
          root: 'libs/proj3',
          name: 'proj3',
        },
        proj4: {
          root: 'libs/proj4',
          name: 'proj4',
        },
      },
    };

    const nxJsonConfiguration = {};

    await tempFs.createFiles({
      './node_modules/lodash/lodash.js': '',
      './node_modules/lodash/package.json': JSON.stringify({
        name: 'lodash',
        version: '4.0.0',
      }),
      './package.json': `{
            "name": "test",
            "dependencies": [],
            "devDependencies": []
          }`,
      './nx.json': JSON.stringify(nxJsonConfiguration),
      './tsconfig.base.json': JSON.stringify({}),
      './libs/proj2/package.json': JSON.stringify({ name: 'proj2' }),
      './libs/proj3/package.json': JSON.stringify({
        name: 'proj3',
        dependencies: { lodash: '3.0.0' },
      }),
      './libs/proj3/node_modules/lodash/index.js': '',
      './libs/proj3/node_modules/lodash/package.json': JSON.stringify({
        name: 'lodash',
        version: '3.0.0',
      }),
      './libs/proj/package.json': JSON.stringify({
        dependencies: { proj2: '*', lodash: '4.0.0' },
        devDependencies: { proj3: '*' },
      }),
    });

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

    const fileMap = createFileMap(
      projectsConfigurations as any,
      await getAllFileDataInContext(tempFs.tempDir)
    ).fileMap;

    const builder = new ProjectGraphBuilder(undefined, fileMap.projectFileMap);
    Object.values(projects).forEach((p) => {
      builder.addNode(p);
    });
    builder.addExternalNode({
      type: 'npm',
      name: 'npm:lodash',
      data: {
        version: '4.0.0',
        packageName: 'lodash',
      },
    });
    builder.addExternalNode({
      type: 'npm',
      name: 'npm:lodash@3.0.0',
      data: {
        version: '3.0.0',
        packageName: 'lodash',
      },
    });

    ctx = {
      fileMap: fileMap,
      externalNodes: builder.getUpdatedProjectGraph().externalNodes,
      projects: projectsConfigurations.projects,
      nxJsonConfiguration,
      filesToProcess: fileMap,
      workspaceRoot: tempFs.tempDir,
    };
  });

  afterAll(() => {
    tempFs.cleanup();
  });

  it(`should add dependencies with mixed versions for projects based on deps in package.json and populate the cache`, async () => {
    const npmResolutionCache = new Map();
    const targetProjectLocator = new TargetProjectLocator(
      {},
      ctx.externalNodes,
      npmResolutionCache
    );

    const res = buildExplicitPackageJsonDependencies(ctx, targetProjectLocator);
    expect(res).toEqual([
      {
        source: 'proj',
        target: 'proj3',
        sourceFile: 'libs/proj/package.json',
        type: 'static',
      },
      {
        source: 'proj',
        target: 'proj2',
        sourceFile: 'libs/proj/package.json',
        type: 'static',
      },
      {
        sourceFile: 'libs/proj/package.json',
        source: 'proj',
        target: 'npm:lodash',
        type: 'static',
      },
      {
        sourceFile: 'libs/proj3/package.json',
        source: 'proj3',
        target: 'npm:lodash@3.0.0',
        type: 'static',
      },
    ]);
    expect(npmResolutionCache).toMatchInlineSnapshot(`
      Map {
        "lodash__libs/proj" => "npm:lodash",
        "lodash__libs/proj3" => "npm:lodash@3.0.0",
      }
    `);
  });

  it(`should preferentially resolve external projects found in the npmResolutionCache`, async () => {
    const npmResolutionCache = new Map();
    const targetProjectLocator = new TargetProjectLocator(
      {},
      ctx.externalNodes,
      npmResolutionCache
    );

    // Add an alternate version of lodash to the cache
    npmResolutionCache.set('lodash__libs/proj', 'npm:lodash@999.9.9');
    npmResolutionCache.set('lodash__libs/proj3', 'npm:lodash@999.9.9');

    const res = buildExplicitPackageJsonDependencies(ctx, targetProjectLocator);
    expect(res).toEqual([
      {
        source: 'proj',
        target: 'proj3',
        sourceFile: 'libs/proj/package.json',
        type: 'static',
      },
      {
        source: 'proj',
        target: 'proj2',
        sourceFile: 'libs/proj/package.json',
        type: 'static',
      },
      {
        sourceFile: 'libs/proj/package.json',
        source: 'proj',
        // Preferred the cached version of lodash, instead of 4.0.0 resolved from tempFs node_modules
        target: 'npm:lodash@999.9.9',
        type: 'static',
      },
      {
        sourceFile: 'libs/proj3/package.json',
        source: 'proj3',
        // Preferred the cached version of lodash, instead of 3.0.0 resolved from tempFs node_modules
        target: 'npm:lodash@999.9.9',
        type: 'static',
      },
    ]);
  });
});
