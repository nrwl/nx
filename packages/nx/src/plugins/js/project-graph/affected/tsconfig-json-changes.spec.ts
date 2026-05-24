import { WholeFileChange } from '../../../../project-graph/file-utils';
import { jsonDiff } from '../../../../utils/json-diff';
import { getTouchedProjectsFromTsConfig } from './tsconfig-json-changes';
import * as tsUtils from '../../utils/typescript';
import { DependencyType, ProjectGraph } from '../../../../config/project-graph';

describe('getTouchedProjectsFromTsConfig', () => {
  let graph: ProjectGraph;
  beforeEach(() => {
    graph = {
      nodes: {
        proj1: {
          name: 'proj1',
          type: 'app',
          data: {
            root: 'proj1',
          },
        },
        proj2: {
          name: 'proj2',
          type: 'lib',
          data: {
            root: 'proj2',
          },
        },
      },
      dependencies: {
        proj1: [
          {
            type: DependencyType.static,
            source: 'proj1',
            target: 'proj2',
          },
        ],
        proj2: [],
      },
    };
  });

  ['tsconfig.json', 'tsconfig.base.json'].forEach((tsConfig) => {
    describe(`(${tsConfig})`, () => {
      beforeEach(() => {
        jest
          .spyOn(tsUtils, 'getRootTsConfigFileName')
          .mockReturnValue(tsConfig);
        jest.clearAllMocks();

        graph.nodes['proj-cdk'] = {
          name: 'proj-cdk',
          type: 'lib',
          data: {
            root: 'libs/typescript/cdk',
          },
        };
        graph.nodes['proj-cdk-utils'] = {
          name: 'proj-cdk-utils',
          type: 'lib',
          data: {
            root: 'libs/typescript/cdk-utils',
          },
        };
      });

      it(`should not return changes when ${tsConfig} is not touched`, () => {
        const result = getTouchedProjectsFromTsConfig(
          [
            {
              file: 'source.ts',
              getChanges: () => [new WholeFileChange()],
            },
          ],
          {},
          {}
        );
        expect(result).toEqual([]);
      });

      describe('Whole File Changes', () => {
        it('should return all projects for a whole file change', () => {
          const result = getTouchedProjectsFromTsConfig(
            [
              {
                file: tsConfig,
                getChanges: () => [new WholeFileChange()],
              },
            ],
            null,
            null,
            null,
            graph
          );
          expect(result).toEqual(['proj1', 'proj2']);
        });
      });

      describe('Changes to other compiler options', () => {
        it('should return all projects', () => {
          const result = getTouchedProjectsFromTsConfig(
            [
              {
                file: tsConfig,
                getChanges: () =>
                  jsonDiff(
                    {
                      compilerOptions: {
                        strict: false,
                      },
                    },
                    {
                      compilerOptions: {
                        strict: true,
                      },
                    }
                  ),
              },
            ],
            null,
            null,
            null,
            graph
          );
          expect(result).toEqual(['proj1', 'proj2']);
        });
      });

      describe('Adding new path mappings', () => {
        it('should return projects pointed to by the path mappings', () => {
          const result = getTouchedProjectsFromTsConfig(
            [
              {
                file: tsConfig,
                getChanges: () =>
                  jsonDiff(
                    {
                      compilerOptions: {
                        paths: {},
                      },
                    },
                    {
                      compilerOptions: {
                        paths: {
                          '@proj/proj1': ['proj1/index.ts'],
                        },
                      },
                    }
                  ),
              },
            ],
            null,
            null,
            null,
            graph
          );
          expect(result).toEqual(['proj1']);
        });

        it('should accept different types of paths', () => {
          const result = getTouchedProjectsFromTsConfig(
            [
              {
                file: tsConfig,
                getChanges: () =>
                  jsonDiff(
                    {
                      compilerOptions: {
                        paths: {},
                      },
                    },
                    {
                      compilerOptions: {
                        paths: {
                          '@proj/proj1': ['./proj1/index.ts'],
                        },
                      },
                    }
                  ),
              },
            ],
            null,
            null,
            null,
            graph
          );
          expect(result).toEqual(['proj1']);
        });
      });

      describe('Removing path mappings', () => {
        it('should affect all projects if a project is removed', () => {
          const result = getTouchedProjectsFromTsConfig(
            [
              {
                file: tsConfig,
                getChanges: () =>
                  jsonDiff(
                    {
                      compilerOptions: {
                        paths: {
                          '@proj/proj1': ['proj1/index.ts'],
                        },
                      },
                    },
                    {
                      compilerOptions: {
                        paths: {},
                      },
                    }
                  ),
              },
            ],
            null,
            null,
            null,
            graph
          );
          expect(result).toEqual(['proj1', 'proj2']);
        });

        it('should affect all projects if a path mapping is removed', () => {
          const result = getTouchedProjectsFromTsConfig(
            [
              {
                file: tsConfig,
                getChanges: () =>
                  jsonDiff(
                    {
                      compilerOptions: {
                        paths: {
                          '@proj/proj1': ['proj1/index.ts', 'proj1/index2.ts'],
                        },
                      },
                    },
                    {
                      compilerOptions: {
                        paths: {
                          '@proj/proj1': ['proj1/index.ts'],
                        },
                      },
                    }
                  ),
              },
            ],
            null,
            null,
            null,
            graph
          );
          expect(result).toContainEqual('proj1');
          expect(result).toContainEqual('proj2');
        });
      });

      describe('Modifying Path Mappings', () => {
        it('should return projects that have path mappings modified within them', () => {
          const result = getTouchedProjectsFromTsConfig(
            [
              {
                file: tsConfig,
                getChanges: () =>
                  jsonDiff(
                    {
                      compilerOptions: {
                        paths: {
                          '@proj/proj1': ['proj1/index.ts'],
                        },
                      },
                    },
                    {
                      compilerOptions: {
                        paths: {
                          '@proj/proj1': ['proj1/index2.ts'],
                        },
                      },
                    }
                  ),
              },
            ],
            null,
            null,
            null,
            graph
          );
          expect(result).toContainEqual('proj1');
          expect(result).not.toContainEqual('proj2');
        });

        it('should return both projects that the mappings used to point to and point to now', () => {
          const result = getTouchedProjectsFromTsConfig(
            [
              {
                file: tsConfig,
                getChanges: () =>
                  jsonDiff(
                    {
                      compilerOptions: {
                        paths: {
                          '@proj/proj1': ['proj1/index.ts'],
                        },
                      },
                    },
                    {
                      compilerOptions: {
                        paths: {
                          '@proj/proj1': ['proj2/index.ts'],
                        },
                      },
                    }
                  ),
              },
            ],
            null,
            null,
            null,
            graph
          );
          expect(result).toContainEqual('proj1');
          expect(result).toContainEqual('proj2');
        });

        it('should not match sibling roots that only share a string prefix', () => {
          const result = getTouchedProjectsFromTsConfig(
            [
              {
                file: tsConfig,
                getChanges: () =>
                  jsonDiff(
                    {
                      compilerOptions: {
                        paths: {
                          '@proj/cdk': ['libs/typescript/cdk/index.ts'],
                        },
                      },
                    },
                    {
                      compilerOptions: {
                        paths: {
                          '@proj/cdk': ['libs/typescript/cdk-utils/index.ts'],
                        },
                      },
                    }
                  ),
              },
            ],
            null,
            null,
            null,
            graph
          );

          expect(result).toContainEqual('proj-cdk');
          expect(result).toContainEqual('proj-cdk-utils');
          expect(result.filter((x) => x === 'proj-cdk')).toHaveLength(1);
          expect(result.filter((x) => x === 'proj-cdk-utils')).toHaveLength(1);
        });
      });
    });
  });
});
