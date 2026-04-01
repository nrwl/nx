import { ProjectGraph } from '../../../../config/project-graph';
import { WholeFileChange } from '../../../../project-graph/file-utils';
import { getTouchedProjectsFromLockFile } from './lock-file-changes';
import { TempFs } from '../../../../internal-testing-utils/temp-fs';
import { JsonDiffType } from '../../../../utils/json-diff';
import { logger } from '../../../../utils/logger';

describe('getTouchedProjectsFromLockFile', () => {
  let graph: ProjectGraph;
  let allNodes = [];
  let tempFs: TempFs;

  beforeEach(() => {
    graph = {
      nodes: {
        proj1: {
          name: 'proj1',
          type: 'app',
          data: {
            root: 'libs/proj1',
          },
        },
        proj2: {
          name: 'proj2',
          type: 'lib',
          data: {
            root: 'packages/proj2',
          },
        },
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'apps/app1',
          },
        },
      },
      externalNodes: {
        'npm:some-external-package': {
          type: 'npm',
          name: 'npm:some-external-package',
          data: {
            version: '0.0.2',
            packageName: 'some-external-package',
            hash: 'abc123',
          },
        },
        'npm:some-other-external-package': {
          type: 'npm',
          name: 'npm:some-other-external-package',
          data: {
            version: '4.0.1',
            packageName: 'some-other-external-package',
            hash: 'def456',
          },
        },
        'npm:unrelated-package': {
          type: 'npm',
          name: 'npm:unrelated-package',
          data: {
            version: '1.0.0',
            packageName: 'unrelated-package',
            hash: 'ghi789',
          },
        },
      },
      dependencies: {},
    };
    allNodes = Object.keys(graph.nodes);
  });

  [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'pnpm-lock.yml',
    'bun.lockb',
    'bun.lock',
  ].forEach((lockFile) => {
    describe(`"${lockFile}"`, () => {
      it(`should not return changes when "${lockFile}" is not touched`, () => {
        const result = getTouchedProjectsFromLockFile(
          [
            {
              file: 'source.ts',
              getChanges: () => [new WholeFileChange()],
            },
          ],
          graph.nodes
        );
        expect(result).toStrictEqual([]);
      });

      it(`should return all nodes when "${lockFile}" is touched`, () => {
        const result = getTouchedProjectsFromLockFile(
          [
            {
              file: lockFile,
              getChanges: () => [new WholeFileChange()],
            },
          ],
          graph.nodes
        );
        expect(result).toStrictEqual(allNodes);
      });
    });
  });

  // Each lock file format has a different JSON structure. The changes
  // array simulates realistic diffs for each format to test that auto
  // mode can identify which packages changed and return the
  // corresponding external node names.
  type AutoModeTestCase = {
    lockFile: string;
    changes: {
      type: JsonDiffType;
      path: (string | number)[];
      value: { lhs: any; rhs: any };
    }[];
    // External node names that should be returned -- the graph reversal
    // in filterAffected walks from these to workspace projects.
    expectedExternalNodes: string[];
  };

  // pnpm-lock.yaml / pnpm-lock.yml
  //
  //   importers:
  //     libs/proj1:
  //       dependencies:
  //         some-external-package:
  //           version: 0.0.1 -> 0.0.2
  //     apps/app1:
  //       devDependencies:
  //         some-other-external-package:
  //           version: (added) 4.0.1
  //     apps/app-that-was-deleted:
  //       devDependencies:
  //         some-other-external-package:
  //           version: 4.0.1 (deleted)
  const pnpmChanges: AutoModeTestCase['changes'] = [
    {
      type: JsonDiffType.Modified,
      path: [
        'importers',
        'libs/proj1',
        'dependencies',
        'some-external-package',
        'version',
      ],
      value: { lhs: '0.0.1', rhs: '0.0.2' },
    },
    {
      type: JsonDiffType.Added,
      path: [
        'importers',
        'apps/app1',
        'devDependencies',
        'some-other-external-package',
        'version',
      ],
      value: { lhs: undefined, rhs: '4.0.1' },
    },
    {
      type: JsonDiffType.Deleted,
      path: [
        'importers',
        'apps/app-that-was-deleted',
        'devDependencies',
        'some-other-external-package',
        'version',
      ],
      value: { lhs: '4.0.1', rhs: undefined },
    },
  ];

  const AUTO_MODE_LOCK_FILES: AutoModeTestCase[] = [
    {
      lockFile: 'pnpm-lock.yaml',
      changes: pnpmChanges,
      expectedExternalNodes: [
        'npm:some-external-package',
        'npm:some-other-external-package',
      ],
    },
    {
      lockFile: 'pnpm-lock.yml',
      changes: pnpmChanges,
      expectedExternalNodes: [
        'npm:some-external-package',
        'npm:some-other-external-package',
      ],
    },
    // package-lock.json (npm v2/v3)
    //
    //   {
    //     "packages": {
    //       "libs/proj1/node_modules/some-external-package": {
    //         "version": "0.0.1" -> "0.0.2"
    //       },
    //       "apps/app1/node_modules/some-other-external-package": {
    //         "version": (added) "4.0.1"
    //       }
    //     }
    //   }
    {
      lockFile: 'package-lock.json',
      changes: [
        {
          type: JsonDiffType.Modified,
          path: [
            'packages',
            'libs/proj1/node_modules/some-external-package',
            'version',
          ],
          value: { lhs: '0.0.1', rhs: '0.0.2' },
        },
        {
          type: JsonDiffType.Added,
          path: [
            'packages',
            'apps/app1/node_modules/some-other-external-package',
            'version',
          ],
          value: { lhs: undefined, rhs: '4.0.1' },
        },
      ],
      expectedExternalNodes: [
        'npm:some-external-package',
        'npm:some-other-external-package',
      ],
    },
    // yarn.lock (flat map -- no per-project structure)
    //
    //   "some-external-package@^0.0.1":
    //     version "0.0.1" -> "0.0.2"
    //
    //   "some-other-external-package@^4.0.0":
    //     version (added) "4.0.1"
    {
      lockFile: 'yarn.lock',
      changes: [
        {
          type: JsonDiffType.Modified,
          path: ['some-external-package@^0.0.1', 'version'],
          value: { lhs: '0.0.1', rhs: '0.0.2' },
        },
        {
          type: JsonDiffType.Added,
          path: ['some-other-external-package@^4.0.0', 'version'],
          value: { lhs: undefined, rhs: '4.0.1' },
        },
      ],
      // yarn now extracts package names from keys and returns external
      // nodes instead of falling back to "all projects"
      expectedExternalNodes: [
        'npm:some-external-package',
        'npm:some-other-external-package',
      ],
    },
    // bun.lock (JSON with "workspaces" keyed by workspace path)
    //
    //   {
    //     "workspaces": {
    //       "libs/proj1": {
    //         "dependencies": {
    //           "some-external-package": "^0.0.1" -> "^0.0.2"
    //         }
    //       },
    //       "apps/app1": {
    //         "devDependencies": {
    //           "some-other-external-package": (added) "^4.0.1"
    //         }
    //       }
    //     }
    //   }
    {
      lockFile: 'bun.lock',
      changes: [
        {
          type: JsonDiffType.Modified,
          path: [
            'workspaces',
            'libs/proj1',
            'dependencies',
            'some-external-package',
          ],
          value: { lhs: '^0.0.1', rhs: '^0.0.2' },
        },
        {
          type: JsonDiffType.Added,
          path: [
            'workspaces',
            'apps/app1',
            'devDependencies',
            'some-other-external-package',
          ],
          value: { lhs: undefined, rhs: '^4.0.1' },
        },
      ],
      expectedExternalNodes: [
        'npm:some-external-package',
        'npm:some-other-external-package',
      ],
    },
  ];

  AUTO_MODE_LOCK_FILES.forEach(
    ({ lockFile, changes, expectedExternalNodes }) => {
      describe(`"${lockFile}" with projectsAffectedByDependencyUpdates set to auto`, () => {
        beforeAll(async () => {
          tempFs = new TempFs('lock-file-changes-test');
          await tempFs.createFiles({
            './nx.json': JSON.stringify({
              pluginsConfig: {
                '@nx/js': {
                  projectsAffectedByDependencyUpdates: 'auto',
                },
              },
            }),
          });
        });

        afterAll(() => {
          tempFs.cleanup();
        });

        it(`should not return changes when "${lockFile}" is not touched`, () => {
          const result = getTouchedProjectsFromLockFile(
            [
              {
                file: 'source.ts',
                getChanges: () => [new WholeFileChange()],
              },
            ],
            graph.nodes,
            undefined,
            undefined,
            graph
          );
          expect(result).toStrictEqual([]);
        });

        // When auto mode sees a WholeFileChange it cannot narrow to
        // specific packages, so all projects should be affected.
        it(`should return all projects when whole lock file "${lockFile}" is changed`, () => {
          const result = getTouchedProjectsFromLockFile(
            [
              {
                file: lockFile,
                getChanges: () => [new WholeFileChange()],
              },
            ],
            graph.nodes,
            undefined,
            undefined,
            graph
          );
          expect(result).toStrictEqual(allNodes);
        });

        it(`should return external nodes for changed packages when "${lockFile}" has dependency changes`, () => {
          const result = getTouchedProjectsFromLockFile(
            [
              {
                file: lockFile,
                getChanges: () => changes,
              },
            ],
            graph.nodes,
            undefined,
            undefined,
            graph
          );
          expect(result).toStrictEqual(expectedExternalNodes);
        });
      });
    }
  );

  // bun.lockb is a binary file (.lockb extension), so the change
  // detection layer always produces a WholeFileChange -- it never
  // gets JSON-diffed. Only the WholeFileChange case is meaningful.
  describe('"bun.lockb" with projectsAffectedByDependencyUpdates set to auto', () => {
    beforeAll(async () => {
      tempFs = new TempFs('lock-file-changes-test');
      await tempFs.createFiles({
        './nx.json': JSON.stringify({
          pluginsConfig: {
            '@nx/js': {
              projectsAffectedByDependencyUpdates: 'auto',
            },
          },
        }),
      });
    });

    afterAll(() => {
      tempFs.cleanup();
    });

    it('should not return changes when "bun.lockb" is not touched', () => {
      const result = getTouchedProjectsFromLockFile(
        [
          {
            file: 'source.ts',
            getChanges: () => [new WholeFileChange()],
          },
        ],
        graph.nodes,
        undefined,
        undefined,
        graph
      );
      expect(result).toStrictEqual([]);
    });

    // Since bun.lockb is binary and always produces WholeFileChange,
    // auto mode should return all projects as a safe fallback.
    it('should return all projects when whole lock file "bun.lockb" is changed', () => {
      const result = getTouchedProjectsFromLockFile(
        [
          {
            file: 'bun.lockb',
            getChanges: () => [new WholeFileChange()],
          },
        ],
        graph.nodes,
        undefined,
        undefined,
        graph
      );
      expect(result).toStrictEqual(allNodes);
    });
  });

  describe('unrecognized lock file with projectsAffectedByDependencyUpdates set to auto', () => {
    beforeAll(async () => {
      tempFs = new TempFs('lock-file-changes-test');
      await tempFs.createFiles({
        './nx.json': JSON.stringify({
          pluginsConfig: {
            '@nx/js': {
              projectsAffectedByDependencyUpdates: 'auto',
            },
          },
        }),
      });
    });

    afterAll(() => {
      tempFs.cleanup();
    });

    // An unrecognized lock file is not in ALL_LOCK_FILES, so it is
    // filtered out before auto mode runs. No projects are affected.
    it('should not return changes for an unrecognized lock file', () => {
      const result = getTouchedProjectsFromLockFile(
        [
          {
            file: 'unknown.lock',
            getChanges: () => [
              {
                type: JsonDiffType.Modified,
                path: ['some', 'path'],
                value: { lhs: '1.0.0', rhs: '2.0.0' },
              },
            ],
          },
        ],
        graph.nodes,
        undefined,
        undefined,
        graph
      );
      expect(result).toStrictEqual([]);
    });
  });

  describe('npm root-level dependency changes with auto mode', () => {
    beforeAll(async () => {
      tempFs = new TempFs('lock-file-changes-test');
      await tempFs.createFiles({
        './nx.json': JSON.stringify({
          pluginsConfig: {
            '@nx/js': {
              projectsAffectedByDependencyUpdates: 'auto',
            },
          },
        }),
      });
    });

    afterAll(() => {
      tempFs.cleanup();
    });

    // Root-level dependencies in package-lock.json are stored under
    // "node_modules/<pkg>" (no project path prefix). The refactored
    // code extracts the package name and looks it up in externalNodes.
    it('should return external nodes for root-level npm dependency changes', () => {
      const result = getTouchedProjectsFromLockFile(
        [
          {
            file: 'package-lock.json',
            getChanges: () => [
              {
                type: JsonDiffType.Modified,
                path: [
                  'packages',
                  'node_modules/some-external-package',
                  'version',
                ],
                value: { lhs: '0.0.1', rhs: '0.0.2' },
              },
            ],
          },
        ],
        graph.nodes,
        undefined,
        undefined,
        graph
      );
      expect(result).toStrictEqual(['npm:some-external-package']);
    });
  });
});
