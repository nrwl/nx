import { DependencyType, type ProjectGraph } from '@nx/devkit';
import type { FileMapCache } from '@nx/devkit/internal';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyProjectNodesAndFiles,
  createReadOnlyTree,
  createStubbedProjectGraphAndFileMapCache,
} from '../../../testing';
import { ReadOnlyConformanceTree } from '../../conformance-tree';

import rule from './index';

describe('enforce-project-boundaries', () => {
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

  describe('violation - noImportsOfApps', () => {
    it('should error when a project depends on an app project', async () => {
      applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, [
        {
          projectNode: {
            name: 'mylibName',
            type: 'lib',
            data: {
              root: 'libs/mylib',
            },
          },
          projectFiles: [
            {
              projectRootRelativeFile: 'src/main.ts',
              depsItCreates: ['myappName'],
            },
          ],
        },
        {
          projectNode: {
            name: 'myappName',
            type: 'app',
            data: {
              root: 'apps/myapp',
            },
          },
        },
      ]);

      const result = await rule.implementation({
        tree,
        projectGraph,
        fileMapCache,
        ruleOptions: {},
      });
      expect(result).toMatchInlineSnapshot(`
{
  "details": {
    "violations": [
      {
        "file": "libs/mylib/src/main.ts",
        "message": "A dependency on an app project is forbidden (found "myappName")",
        "sourceProject": "mylibName",
      },
    ],
  },
  "severity": "medium",
}
`);
    });

    it('should not error when a project depends on an app project via an implicit dependency', async () => {
      applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, [
        {
          projectNode: {
            name: 'myappE2eName',
            type: 'e2e',
            data: {
              root: 'apps/myapp-e2e',
            },
          },
          projectFiles: [
            {
              projectRootRelativeFile: 'project.json',
              depsItCreates: [['myappName', DependencyType.implicit]],
            },
          ],
        },
        {
          projectNode: {
            name: 'myappName',
            type: 'app',
            data: {
              root: 'apps/myapp',
            },
          },
        },
      ]);

      const result = await rule.implementation({
        tree,
        projectGraph,
        fileMapCache,
        ruleOptions: {},
      });
      expect(result).toMatchInlineSnapshot(`
{
  "details": {
    "violations": [],
  },
  "severity": "medium",
}
`);
    });
  });

  describe('violation - noImportsOfE2e', () => {
    it('should error when a project depends on an e2e project', async () => {
      applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, [
        {
          projectNode: {
            name: 'proj',
            type: 'lib',
            data: {
              root: 'proj',
            },
          },
          projectFiles: [
            {
              projectRootRelativeFile: 'some-file.js',
              depsItCreates: ['e2eProject'],
            },
          ],
        },
        {
          projectNode: {
            name: 'e2eProject',
            type: 'e2e',
            data: {
              root: 'e2e-project',
            },
          },
        },
      ]);

      const result = await rule.implementation({
        tree,
        projectGraph,
        fileMapCache,
        ruleOptions: {},
      });
      expect(result).toMatchInlineSnapshot(`
{
  "details": {
    "violations": [
      {
        "file": "proj/some-file.js",
        "message": "A dependency on an e2e project is forbidden (found "e2eProject")",
        "sourceProject": "proj",
      },
    ],
  },
  "severity": "medium",
}
`);
    });
  });

  describe('violation - noCircularDependencies', () => {
    it('should error when circular dependency detected', async () => {
      applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, [
        {
          projectNode: {
            name: 'mylibName',
            type: 'lib',
            data: {
              root: 'libs/mylib',
            },
          },
          projectFiles: [
            {
              projectRootRelativeFile: 'src/main.ts',
              depsItCreates: ['anotherlibName'],
            },
          ],
        },
        {
          projectNode: {
            name: 'anotherlibName',
            type: 'lib',
            data: {
              root: 'libs/anotherlib',
            },
          },
          projectFiles: [
            {
              projectRootRelativeFile: 'src/main.ts',
              depsItCreates: ['mylibName'],
            },
          ],
        },
      ]);

      const result = await rule.implementation({
        tree,
        projectGraph,
        fileMapCache,
        ruleOptions: {},
      });
      expect(result).toMatchInlineSnapshot(`
{
  "details": {
    "violations": [
      {
        "file": "libs/mylib/src/main.ts",
        "message": "Circular dependency detected: anotherlibName <-> mylibName",
        "sourceProject": "mylibName",
      },
      {
        "file": "libs/anotherlib/src/main.ts",
        "message": "Circular dependency detected: mylibName <-> anotherlibName",
        "sourceProject": "anotherlibName",
      },
    ],
  },
  "severity": "medium",
}
`);
    });

    it('should ignore detected circular dependency if it matches ignoredCircularDependencies', async () => {
      applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, [
        {
          projectNode: {
            name: 'mylibName',
            type: 'lib',
            data: {
              root: 'libs/mylib',
            },
          },
          projectFiles: [
            {
              projectRootRelativeFile: 'src/main.ts',
              depsItCreates: ['anotherlibName'],
            },
          ],
        },
        {
          projectNode: {
            name: 'anotherlibName',
            type: 'lib',
            data: {
              root: 'libs/anotherlib',
            },
          },
          projectFiles: [
            {
              projectRootRelativeFile: 'src/main.ts',
              depsItCreates: ['mylibName'],
            },
          ],
        },
      ]);

      const result = await rule.implementation({
        tree,
        projectGraph,
        fileMapCache,
        ruleOptions: {
          ignoredCircularDependencies: [['mylibName', 'anotherlibName']],
        },
      });

      expect(result).toMatchInlineSnapshot(`
{
  "details": {
    "violations": [],
  },
  "severity": "medium",
}
`);
    });
  });

  describe('ruleOptions - depConstraints', () => {
    describe('violation - projectWithoutTagsCannotHaveDependencies', () => {
      it('should error when one or more depConstraints are set but a project without any tags matching the constraint(s) depends on another project', async () => {
        applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, [
          {
            projectNode: {
              name: 'myappName',
              type: 'app',
              data: {
                root: 'apps/myapp',
                tags: [],
              },
            },
            projectFiles: [
              {
                projectRootRelativeFile: 'src/main.ts',
                depsItCreates: ['mylibName'],
              },
            ],
          },
          {
            projectNode: {
              name: 'mylibName',
              type: 'lib',
              data: {
                root: 'libs/mylib',
                tags: [],
              },
            },
          },
        ]);

        const result = await rule.implementation({
          tree,
          projectGraph,
          fileMapCache,
          ruleOptions: {
            depConstraints: [
              // We only need a single constraint that is unmatched to trigger the violation
              { sourceTag: 'api', onlyDependOnProjectsWithTags: ['api'] },
            ],
          },
        });
        expect(result).toMatchInlineSnapshot(`
{
  "details": {
    "violations": [
      {
        "file": "apps/myapp/src/main.ts",
        "message": "A project without tags matching at least one entry in depConstraints cannot depend on any other projects (found "mylibName")",
        "sourceProject": "myappName",
      },
    ],
  },
  "severity": "medium",
}
`);
      });
    });

    describe('violation - onlyTagsConstraintViolation', () => {
      it('should error when a project with particular tags depends on another project without the required tags', async () => {
        applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, [
          {
            projectNode: {
              name: 'myappName',
              type: 'app',
              data: {
                root: 'apps/myapp',
                tags: ['api'],
              },
            },
            projectFiles: [
              {
                projectRootRelativeFile: 'src/main.ts',
                depsItCreates: ['mylibName'],
              },
            ],
          },
          {
            projectNode: {
              name: 'mylibName',
              type: 'lib',
              data: {
                root: 'libs/mylib',
                tags: [],
              },
            },
          },
        ]);

        const result = await rule.implementation({
          tree,
          projectGraph,
          fileMapCache,
          ruleOptions: {
            depConstraints: [
              { sourceTag: 'api', onlyDependOnProjectsWithTags: ['api'] },
            ],
          },
        });
        expect(result).toMatchInlineSnapshot(`
{
  "details": {
    "violations": [
      {
        "file": "apps/myapp/src/main.ts",
        "message": "A project tagged with "api" can only depend on projects with tags: "api" (found "mylibName")",
        "sourceProject": "myappName",
      },
    ],
  },
  "severity": "medium",
}
`);
      });
    });

    describe('violation - emptyOnlyTagsConstraintViolation', () => {
      it('should error when the target project is tagged, if the source project does not expect it', async () => {
        applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, [
          {
            projectNode: {
              name: 'privateName',
              type: 'lib',
              data: {
                root: 'libs/private',
                tags: ['private'],
                implicitDependencies: [],
                targets: {},
              },
            },
            projectFiles: [
              {
                projectRootRelativeFile: 'src/main.ts',
                depsItCreates: ['mylibName'],
              },
            ],
          },
          {
            projectNode: {
              name: 'mylibName',
              type: 'lib',
              data: {
                root: 'libs/mylib',
                tags: ['some-tag'],
              },
            },
          },
        ]);

        const result = await rule.implementation({
          tree,
          projectGraph,
          fileMapCache,
          ruleOptions: {
            depConstraints: [
              { sourceTag: 'private', onlyDependOnProjectsWithTags: [] },
            ],
          },
        });
        expect(result).toMatchInlineSnapshot(`
{
  "details": {
    "violations": [
      {
        "file": "libs/private/src/main.ts",
        "message": "A project tagged with "private" cannot depend on any projects with tags (found "mylibName")",
        "sourceProject": "privateName",
      },
    ],
  },
  "severity": "medium",
}
`);
      });
    });

    describe('violation - notTagsConstraintViolation', () => {
      it('should error when the target project has a disallowed tag', async () => {
        applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, [
          {
            projectNode: {
              name: 'proj1',
              type: 'lib',
              data: {
                root: 'libs/proj1',
                tags: ['public'],
              },
            },
            projectFiles: [
              {
                projectRootRelativeFile: 'src/main.ts',
                depsItCreates: ['proj2'],
              },
            ],
          },
          {
            projectNode: {
              name: 'proj2',
              type: 'lib',
              data: {
                root: 'libs/proj2',
                tags: ['private'],
              },
            },
          },
        ]);

        const result = await rule.implementation({
          tree,
          projectGraph,
          fileMapCache,
          ruleOptions: {
            depConstraints: [
              { sourceTag: 'public', notDependOnProjectsWithTags: ['private'] },
            ],
          },
        });
        expect(result).toMatchInlineSnapshot(`
{
  "details": {
    "violations": [
      {
        "file": "libs/proj1/src/main.ts",
        "message": "A project tagged with "public" cannot depend on any projects with tags: "private" (found "proj2")",
        "sourceProject": "proj1",
      },
    ],
  },
  "severity": "medium",
}
`);
      });
    });
  });

  describe('ruleOptions - requireBuildableDependenciesForBuildableProjects', () => {
    it('should error when a buildable project depends on a non-buildable project', async () => {
      applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, [
        {
          projectNode: {
            name: 'mylibName',
            type: 'lib',
            data: {
              root: 'libs/mylib',
              targets: {
                build: {
                  executor: 'tsc',
                },
              },
            },
          },
          projectFiles: [
            {
              projectRootRelativeFile: 'src/main.ts',
              depsItCreates: ['nonBuildableLibName'],
            },
          ],
        },
        {
          projectNode: {
            name: 'nonBuildableLibName',
            type: 'lib',
            data: {
              root: 'libs/non-buildable-lib',
            },
          },
        },
      ]);

      const result = await rule.implementation({
        tree,
        projectGraph,
        fileMapCache,
        ruleOptions: {
          requireBuildableDependenciesForBuildableProjects: true,
        },
      });
      expect(result).toMatchInlineSnapshot(`
{
  "details": {
    "violations": [
      {
        "file": "libs/mylib/src/main.ts",
        "message": "A buildable project cannot depend on a non-buildable project (found "nonBuildableLibName")",
        "sourceProject": "mylibName",
      },
    ],
  },
  "severity": "medium",
}
`);
    });

    it('should error when a buildable project depends on a non-buildable project, when using custom build target names', async () => {
      applyProjectNodesAndFiles(tree, projectGraph, fileMapCache, [
        {
          projectNode: {
            name: 'mylibName',
            type: 'lib',
            data: {
              root: 'libs/mylib',
              targets: {
                'non-standard-build-target': {
                  executor: 'go build',
                },
              },
            },
          },
          projectFiles: [
            {
              projectRootRelativeFile: 'src/main.ts',
              depsItCreates: ['nonBuildableLibName'],
            },
          ],
        },
        {
          projectNode: {
            name: 'nonBuildableLibName',
            type: 'lib',
            data: {
              root: 'libs/non-buildable-lib',
            },
          },
        },
      ]);

      const result = await rule.implementation({
        tree,
        projectGraph,
        fileMapCache,
        ruleOptions: {
          requireBuildableDependenciesForBuildableProjects: {
            buildTargetNames: ['non-standard-build-target'],
          },
        },
      });
      expect(result).toMatchInlineSnapshot(`
{
  "details": {
    "violations": [
      {
        "file": "libs/mylib/src/main.ts",
        "message": "A buildable project cannot depend on a non-buildable project (found "nonBuildableLibName")",
        "sourceProject": "mylibName",
      },
    ],
  },
  "severity": "medium",
}
`);
    });
  });
});
