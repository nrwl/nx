import { ProjectGraph } from '../../../../config/project-graph';
import { WholeFileChange } from '../../../../project-graph/file-utils';
import { getTouchedProjectsFromLockFile } from './lock-file-changes';

describe('getTouchedProjectsFromLockFile', () => {
  let graph: ProjectGraph;
  let allNodes = [];

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

  ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'pnpm-lock.yml'].forEach(
    (lockFile) => {
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
    }
  );
});
