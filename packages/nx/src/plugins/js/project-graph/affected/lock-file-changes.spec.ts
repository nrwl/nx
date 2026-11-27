import { ProjectGraph } from '../../../../config/project-graph';
import {
  LockFileChange,
  WholeFileChange,
} from '../../../../project-graph/file-utils';
import { getTouchedProjectsFromLockFile } from './lock-file-changes';
import { TempFs } from '../../../../internal-testing-utils/temp-fs';
import { output } from '../../../../utils/output';

describe('getTouchedProjectsFromLockFile', () => {
  let graph: ProjectGraph;
  let allNodes: string[] = [];
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
    describe(`"${lockFile}" in default ("all") mode`, () => {
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

  describe('auto mode', () => {
    const autoNxJson = {
      pluginsConfig: {
        '@nx/js': {
          projectsAffectedByDependencyUpdates: 'auto' as const,
        },
      },
    };

    // Real lock file fragments for each package manager. Each "base"
    // and "head" pair is parsed by the matching Nx lock file parser;
    // auto mode extracts changed package names by diffing the resulting
    // external-node maps.

    // pnpm v9 lockfile with two packages. The head content bumps
    // some-external-package to 0.0.2 and adds some-other-external-package.
    const pnpmBase = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      some-external-package:
        specifier: ^0.0.1
        version: 0.0.1

packages:

  some-external-package@0.0.1:
    resolution: {integrity: sha512-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa==}

snapshots:

  some-external-package@0.0.1: {}

`;

    const pnpmHead = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      some-external-package:
        specifier: ^0.0.2
        version: 0.0.2
      some-other-external-package:
        specifier: ^4.0.1
        version: 4.0.1

packages:

  some-external-package@0.0.2:
    resolution: {integrity: sha512-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb==}

  some-other-external-package@4.0.1:
    resolution: {integrity: sha512-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc==}

snapshots:

  some-external-package@0.0.2: {}

  some-other-external-package@4.0.1: {}

`;

    // package-lock.json v3 (lockfileVersion: 3) with root and transitive entries
    const npmBase = JSON.stringify({
      name: 'test',
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': {
          name: 'test',
          version: '1.0.0',
          dependencies: {
            'some-external-package': '^0.0.1',
          },
        },
        'node_modules/some-external-package': {
          version: '0.0.1',
          resolved:
            'https://registry.npmjs.org/some-external-package/-/some-external-package-0.0.1.tgz',
          integrity:
            'sha512-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa==',
        },
      },
    });

    const npmHead = JSON.stringify({
      name: 'test',
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': {
          name: 'test',
          version: '1.0.0',
          dependencies: {
            'some-external-package': '^0.0.2',
            'some-other-external-package': '^4.0.1',
          },
        },
        'node_modules/some-external-package': {
          version: '0.0.2',
          resolved:
            'https://registry.npmjs.org/some-external-package/-/some-external-package-0.0.2.tgz',
          integrity:
            'sha512-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb==',
        },
        'node_modules/some-other-external-package': {
          version: '4.0.1',
          resolved:
            'https://registry.npmjs.org/some-other-external-package/-/some-other-external-package-4.0.1.tgz',
          integrity:
            'sha512-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc==',
        },
      },
    });

    // yarn classic lockfile format
    const yarnBase = `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1


some-external-package@^0.0.1:
  version "0.0.1"
  resolved "https://registry.yarnpkg.com/some-external-package/-/some-external-package-0.0.1.tgz#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  integrity sha512-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa==
`;

    const yarnHead = `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1


some-external-package@^0.0.2:
  version "0.0.2"
  resolved "https://registry.yarnpkg.com/some-external-package/-/some-external-package-0.0.2.tgz#bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  integrity sha512-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb==

some-other-external-package@^4.0.1:
  version "4.0.1"
  resolved "https://registry.yarnpkg.com/some-other-external-package/-/some-other-external-package-4.0.1.tgz#cccccccccccccccccccccccccccccccccccccccc"
  integrity sha512-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc==
`;

    // bun text-format lockfile
    const bunBase = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "test",
      "dependencies": {
        "some-external-package": "^0.0.1"
      }
    }
  },
  "packages": {
    "some-external-package": ["some-external-package@0.0.1", "", {}, "sha512-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=="]
  }
}`;

    const bunHead = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "test",
      "dependencies": {
        "some-external-package": "^0.0.2",
        "some-other-external-package": "^4.0.1"
      }
    }
  },
  "packages": {
    "some-external-package": ["some-external-package@0.0.2", "", {}, "sha512-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb=="],
    "some-other-external-package": ["some-other-external-package@4.0.1", "", {}, "sha512-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc=="]
  }
}`;

    type AutoModeCase = {
      lockFile: string;
      base: string;
      head: string;
    };

    const AUTO_CASES: AutoModeCase[] = [
      { lockFile: 'pnpm-lock.yaml', base: pnpmBase, head: pnpmHead },
      { lockFile: 'pnpm-lock.yml', base: pnpmBase, head: pnpmHead },
      { lockFile: 'package-lock.json', base: npmBase, head: npmHead },
      { lockFile: 'yarn.lock', base: yarnBase, head: yarnHead },
      // bun.lockb is normalized through the existing Bun lockfile
      // reader, which today feeds the shared Yarn-style parser path.
      { lockFile: 'bun.lockb', base: yarnBase, head: yarnHead },
      { lockFile: 'bun.lock', base: bunBase, head: bunHead },
    ];

    beforeAll(async () => {
      tempFs = new TempFs('lock-file-changes-test');
      await tempFs.createFiles({
        // pnpm-parser v9 code path reads this at parse time; provide
        // a minimal empty hoisted definition so parsing succeeds.
        './node_modules/.modules.yaml': `hoistedDependencies: {}\n`,
      });
    });

    afterAll(() => {
      tempFs.cleanup();
    });

    // A lockfile that parses and contains none of the packages in `base`.
    const emptyLockFile = (lockFile: string): string => {
      if (lockFile === 'yarn.lock' || lockFile === 'bun.lockb') {
        return '# yarn lockfile v1\n\n\n';
      }
      if (lockFile === 'package-lock.json') {
        return JSON.stringify({
          name: 'test',
          version: '1.0.0',
          lockfileVersion: 3,
          requires: true,
          packages: {
            '': { name: 'test', version: '1.0.0' },
          },
        });
      }
      if (lockFile === 'bun.lock') {
        return `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "test" } },
  "packages": {}
}`;
      }
      return `lockfileVersion: '9.0'

importers:

  .: {}

`;
    };

    const graphWithoutRemovedPackage = (): ProjectGraph => ({
      ...graph,
      externalNodes: {
        'npm:unrelated-package': graph.externalNodes['npm:unrelated-package']!,
      },
      dependencies: {},
    });

    AUTO_CASES.forEach(({ lockFile, base, head }) => {
      describe(`"${lockFile}"`, () => {
        it('should not return changes when the lock file is untouched', () => {
          const result = getTouchedProjectsFromLockFile(
            [
              {
                file: 'source.ts',
                getChanges: () => [new WholeFileChange()],
              },
            ],
            graph.nodes,
            autoNxJson,
            undefined,
            graph
          );
          expect(result).toStrictEqual([]);
        });

        it('should return all projects when the full lock file changed (WholeFileChange)', () => {
          const result = getTouchedProjectsFromLockFile(
            [
              {
                file: lockFile,
                getChanges: () => [new WholeFileChange()],
              },
            ],
            graph.nodes,
            autoNxJson,
            undefined,
            graph
          );
          expect(result).toStrictEqual(allNodes);
        });

        it('should return no projects when base and head contents are identical', () => {
          const result = getTouchedProjectsFromLockFile(
            [
              {
                file: lockFile,
                getChanges: () => [new LockFileChange(base, base)],
              },
            ],
            graph.nodes,
            autoNxJson,
            undefined,
            graph
          );
          expect(result).toStrictEqual([]);
        });

        it('should return external nodes for packages whose versions changed or were added', () => {
          const result = getTouchedProjectsFromLockFile(
            [
              {
                file: lockFile,
                getChanges: () => [new LockFileChange(base, head)],
              },
            ],
            graph.nodes,
            autoNxJson,
            undefined,
            graph
          );
          expect(result.sort()).toStrictEqual(
            [
              'npm:some-external-package',
              'npm:some-other-external-package',
            ].sort()
          );
        });

        it('should return no projects when a removed package has no dependents', () => {
          // The package exists only in the base lockfile and the head graph
          // has no node for it. Nothing depends on it, so this is not the
          // all-projects fallback.
          const prunedGraph = graphWithoutRemovedPackage();

          const result = getTouchedProjectsFromLockFile(
            [
              {
                file: lockFile,
                getChanges: () => [
                  new LockFileChange(base, emptyLockFile(lockFile)),
                ],
              },
            ],
            prunedGraph.nodes,
            autoNxJson,
            undefined,
            prunedGraph
          );
          expect(result).toStrictEqual([]);
        });

        it('should return only projects that depend on a package removed from the lockfile', () => {
          const prunedGraph: ProjectGraph = {
            ...graphWithoutRemovedPackage(),
            dependencies: {
              proj1: [
                {
                  type: 'static',
                  source: 'proj1',
                  target: 'npm:some-external-package@0.0.1',
                },
              ],
            },
          };

          const result = getTouchedProjectsFromLockFile(
            [
              {
                file: lockFile,
                getChanges: () => [
                  new LockFileChange(base, emptyLockFile(lockFile)),
                ],
              },
            ],
            prunedGraph.nodes,
            autoNxJson,
            undefined,
            prunedGraph
          );
          expect(result).toStrictEqual(['proj1']);
        });

        it('should return only projects whose package.json depends on a removed package', () => {
          const manifestPath = 'libs/proj1/package.json';
          tempFs.createFileSync(
            manifestPath,
            JSON.stringify({
              name: 'proj1',
              devDependencies: { 'some-external-package': '^0.0.1' },
            })
          );
          const prunedGraph = graphWithoutRemovedPackage();
          try {
            const result = getTouchedProjectsFromLockFile(
              [
                {
                  file: lockFile,
                  getChanges: () => [
                    new LockFileChange(base, emptyLockFile(lockFile)),
                  ],
                },
              ],
              prunedGraph.nodes,
              autoNxJson,
              undefined,
              prunedGraph
            );
            expect(result).toStrictEqual(['proj1']);
          } finally {
            tempFs.removeFileSync(manifestPath);
          }
        });

        it('should touch the root project when the root package.json depends on a removed package', () => {
          const prunedGraph: ProjectGraph = {
            ...graphWithoutRemovedPackage(),
            nodes: {
              ...graph.nodes,
              root: {
                name: 'root',
                type: 'app',
                data: { root: '.' },
              },
            },
          };

          const result = getTouchedProjectsFromLockFile(
            [
              {
                file: lockFile,
                getChanges: () => [
                  new LockFileChange(base, emptyLockFile(lockFile)),
                ],
              },
            ],
            prunedGraph.nodes,
            autoNxJson,
            {
              name: 'test',
              version: '1.0.0',
              dependencies: { 'some-external-package': '^0.0.1' },
            },
            prunedGraph
          );
          expect(result).toStrictEqual(['root']);
        });

        it('should not fall back to all projects when a removal accompanies a resolved version change', () => {
          // Head revision is the `base` fixture: some-other-external-package is
          // gone, and some-external-package changed. Only that package has a head node.
          const mixedGraph: ProjectGraph = {
            ...graph,
            externalNodes: {
              'npm:some-external-package':
                graph.externalNodes['npm:some-external-package']!,
            },
            dependencies: {
              proj2: [
                {
                  type: 'static',
                  source: 'proj2',
                  target: 'npm:some-other-external-package',
                },
              ],
            },
          };

          const result = getTouchedProjectsFromLockFile(
            [
              {
                file: lockFile,
                getChanges: () => [new LockFileChange(head, base)],
              },
            ],
            mixedGraph.nodes,
            autoNxJson,
            undefined,
            mixedGraph
          );
          expect(result.sort()).toStrictEqual(
            ['npm:some-external-package', 'proj2'].sort()
          );
        });

        it('should return all projects when only some changed packages exist in the current external node graph', () => {
          const partiallyMappedGraph: ProjectGraph = {
            ...graph,
            externalNodes: {
              'npm:some-external-package':
                graph.externalNodes['npm:some-external-package']!,
            },
          };

          const result = getTouchedProjectsFromLockFile(
            [
              {
                file: lockFile,
                getChanges: () => [new LockFileChange(base, head)],
              },
            ],
            partiallyMappedGraph.nodes,
            autoNxJson,
            undefined,
            partiallyMappedGraph
          );

          expect(result).toStrictEqual(allNodes);
        });
      });
    });

    describe('same-version lockfile changes', () => {
      it('should return touched packages when only the resolved artifact hash changes', () => {
        const base = JSON.stringify({
          name: 'test',
          version: '1.0.0',
          lockfileVersion: 3,
          requires: true,
          packages: {
            '': {
              name: 'test',
              version: '1.0.0',
              dependencies: {
                'some-external-package': '^0.0.1',
              },
            },
            'node_modules/some-external-package': {
              version: '0.0.1',
              resolved:
                'https://registry.npmjs.org/some-external-package/-/some-external-package-0.0.1.tgz',
              integrity:
                'sha512-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa==',
            },
          },
        });

        const head = JSON.stringify({
          name: 'test',
          version: '1.0.0',
          lockfileVersion: 3,
          requires: true,
          packages: {
            '': {
              name: 'test',
              version: '1.0.0',
              dependencies: {
                'some-external-package': '^0.0.1',
              },
            },
            'node_modules/some-external-package': {
              version: '0.0.1',
              resolved:
                'https://registry.npmjs.org/some-external-package/-/some-external-package-0.0.1.tgz',
              integrity:
                'sha512-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz==',
            },
          },
        });

        const result = getTouchedProjectsFromLockFile(
          [
            {
              file: 'package-lock.json',
              getChanges: () => [new LockFileChange(base, head)],
            },
          ],
          graph.nodes,
          autoNxJson,
          undefined,
          graph
        );

        expect(result).toStrictEqual(['npm:some-external-package']);
      });
    });

    describe('unrecognized lock file', () => {
      it('should not return changes -- unknown files are not recognized as lock files', () => {
        const result = getTouchedProjectsFromLockFile(
          [
            {
              file: 'unknown.lock',
              getChanges: () => [new WholeFileChange()],
            },
          ],
          graph.nodes,
          autoNxJson,
          undefined,
          graph
        );
        expect(result).toStrictEqual([]);
      });
    });

    describe('malformed lock file', () => {
      it('should return all projects when parsing the lock file fails', () => {
        const warnSpy = vi.spyOn(output, 'warn').mockImplementation();
        const result = getTouchedProjectsFromLockFile(
          [
            {
              file: 'package-lock.json',
              getChanges: () => [
                new LockFileChange('not json at all', 'still not json'),
              ],
            },
          ],
          graph.nodes,
          autoNxJson,
          undefined,
          graph
        );
        expect(result).toStrictEqual(allNodes);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
      });
    });
  });
});
