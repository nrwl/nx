import { ProjectGraph } from '../../../../config/project-graph';
import { WholeFileChange } from '../../../../project-graph/file-utils';
import {
  getTouchedProjectsFromLockFile,
  PNPM_LOCK_FILES,
} from './lock-file-changes';
import { TempFs } from '../../../../internal-testing-utils/temp-fs';
import { JsonDiffType } from '../../../../utils/json-diff';

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
              hash: 'some-hash',
              getChanges: () => [new WholeFileChange()],
            },
          ],
          graph.nodes
        );
        expect(result).toEqual([]);
      });

      it(`should return all nodes when "${lockFile}" is touched`, () => {
        const result = getTouchedProjectsFromLockFile(
          [
            {
              file: lockFile,
              hash: 'some-hash',
              getChanges: () => [new WholeFileChange()],
            },
          ],
          graph.nodes
        );
        expect(result).toEqual(allNodes);
      });
    });
  });

  PNPM_LOCK_FILES.forEach((lockFile) => {
    describe(`"${lockFile} with projectsAffectedByDependencyUpdates set to auto"`, () => {
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
              hash: 'some-hash',
              getChanges: () => [new WholeFileChange()],
            },
          ],
          graph.nodes
        );
        expect(result).toEqual([]);
      });

      it(`should not return changes when whole lock file "${lockFile}" is changed`, () => {
        const result = getTouchedProjectsFromLockFile(
          [
            {
              file: lockFile,
              hash: 'some-hash',
              getChanges: () => [new WholeFileChange()],
            },
          ],
          graph.nodes
        );
        expect(result).toEqual([]);
      });

      it(`should return only changed projects when "${lockFile}" is touched`, () => {
        const result = getTouchedProjectsFromLockFile(
          [
            {
              file: lockFile,
              hash: 'some-hash',
              getChanges: () => [
                {
                  type: JsonDiffType.Modified,
                  path: [
                    'importers',
                    'libs/proj1',
                    'dependencies',
                    'some-external-package',
                    'version',
                  ],
                  value: {
                    lhs: '0.0.1',
                    rhs: '0.0.2',
                  },
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
                  value: {
                    lhs: undefined,
                    rhs: '4.0.1',
                  },
                },
              ],
            },
          ],
          graph.nodes
        );
        expect(result).toEqual(['proj1', 'app1']);
      });
    });
  });
});
