import type { ReadOnlyConformanceTree } from '@nx/conformance';
import {
  createReadOnlyTree,
  createStubbedProjectGraphAndFileMapCache,
} from '@nx/conformance/testing';
import type { ProjectGraph } from '@nx/devkit';
import type { FileMapCache } from '@nx/devkit/internal';

import rule from './index';

describe('ensure-owners', () => {
  let tree: ReadOnlyConformanceTree;
  let projectGraph: ProjectGraph;
  let fileMapCache: FileMapCache;
  let cleanup: () => void;

  beforeEach(async () => {
    ({ tree, cleanup } = await createReadOnlyTree());
    ({ projectGraph, fileMapCache } =
      await createStubbedProjectGraphAndFileMapCache(tree, []));
  });

  afterEach(() => cleanup());

  it('should return no violations when all projects have owners', async () => {
    projectGraph = {
      nodes: {
        project1: {
          name: 'project1',
          type: 'app',
          data: {
            root: 'libs/project1',
            metadata: {
              owners: { 'team-a': {} },
            } as any,
          },
        },
        project2: {
          name: 'project2',
          type: 'lib',
          data: {
            root: 'libs/project2',
            metadata: {
              owners: { 'team-b': {}, 'team-c': {} },
            } as any,
          },
        },
      },
      dependencies: {},
    };

    const result = await rule.implementation({
      tree,
      projectGraph,
      fileMapCache,
      ruleOptions: {},
    });

    expect(result.details.violations).toMatchInlineSnapshot(`[]`);
  });

  it('should return violating project names when they are missing owners', async () => {
    projectGraph = {
      nodes: {
        project1: {
          name: 'project1',
          type: 'app',
          data: {
            root: 'libs/project1',
            metadata: {
              owners: { 'team-a': {} },
            } as any,
          },
        },
        project2: {
          name: 'project2',
          type: 'lib',
          data: {
            root: 'libs/project2',
            metadata: {},
          },
        },
        project3: {
          name: 'project3',
          type: 'lib',
          data: {
            root: 'libs/project3',
            metadata: {
              owners: {},
            } as any,
          },
        },
      },
      dependencies: {},
    };

    const result = await rule.implementation({
      tree,
      projectGraph,
      fileMapCache,
      ruleOptions: {},
    });

    expect(result.details.violations).toMatchInlineSnapshot(`
[
  {
    "message": "This project currently has no owners defined via Nx Owners.",
    "sourceProject": "project2",
  },
  {
    "message": "This project currently has no owners defined via Nx Owners.",
    "sourceProject": "project3",
  },
]
`);
  });
});
