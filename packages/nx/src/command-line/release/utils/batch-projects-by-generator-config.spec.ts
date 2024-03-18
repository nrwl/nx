import { ProjectGraph } from '../../../config/project-graph';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { batchProjectsByGeneratorConfig } from './batch-projects-by-generator-config';

describe('batchProjectsByGeneratorConfig()', () => {
  it('should work for multiple levels of generatorOptions nesting and should not be key order dependent', () => {
    const projectGraph = getProjectGraph();

    const releaseGroup: ReleaseGroupWithName = {
      projects: ['foo', 'bar', 'baz', 'qux'],
      version: {
        // qux will be the only one that has a different generator
        generator: '@nx/js:release-version',
        // overridden at the project level by foo and bar (see getProjectGraph() below)
        generatorOptions: {},
      },
    } as any; // we don't care about the other properties for this test

    expect(
      batchProjectsByGeneratorConfig(projectGraph, releaseGroup, [
        'foo',
        'bar',
        'baz',
        'qux',
      ])
    ).toMatchInlineSnapshot(`
      Map {
        "["@nx/js:release-version",{"bar":"string","foo":true,"o":{"nested2":[],"nested1":false},"arr":["1",2,false]}]" => [
          "foo",
          "bar",
        ],
        "["@nx/js:release-version",{}]" => [
          "baz",
        ],
        "["@nx/some:other-generator",{}]" => [
          "qux",
        ],
      }
    `);
  });
});

/**
 * Taken from a real workspace in which the generatorOptions config for foo and bar are intentionally
 * functionally identical but ordered differently to ensure they will be batched together correctly.
 */
function getProjectGraph(): ProjectGraph {
  return {
    dependencies: {},
    nodes: {
      bar: {
        name: 'bar',
        type: 'lib',
        data: {
          root: 'packages/bar',
          name: 'bar',
          targets: {
            test: {
              executor: 'nx:run-script',
              options: {
                script: 'test',
              },
              configurations: {},
            },
            'nx-release-publish': {
              dependsOn: ['^nx-release-publish'],
              executor: '@nx/js:release-publish',
              options: {},
              configurations: {},
            },
          },
          sourceRoot: 'packages/bar',
          projectType: 'library',
          release: {
            version: {
              generatorOptions: {
                arr: ['1', 2, false],
                foo: true,
                bar: 'string',
                o: {
                  nested1: false,
                  nested2: [],
                },
              },
            },
          },
          implicitDependencies: [],
          tags: [],
        },
      },
      baz: {
        name: 'baz',
        type: 'lib',
        data: {
          root: 'packages/baz',
          name: 'baz',
          targets: {
            test: {
              executor: 'nx:run-script',
              options: {
                script: 'test',
              },
              configurations: {},
            },
            'nx-release-publish': {
              dependsOn: ['^nx-release-publish'],
              executor: '@nx/js:release-publish',
              options: {},
              configurations: {},
            },
          },
          sourceRoot: 'packages/baz',
          projectType: 'library',
          implicitDependencies: [],
          tags: [],
        },
      },
      foo: {
        name: 'foo',
        type: 'lib',
        data: {
          root: 'packages/foo',
          name: 'foo',
          targets: {
            test: {
              executor: 'nx:run-script',
              options: {
                script: 'test',
              },
              configurations: {},
            },
            'nx-release-publish': {
              dependsOn: ['^nx-release-publish'],
              executor: '@nx/js:release-publish',
              options: {},
              configurations: {},
            },
          },
          sourceRoot: 'packages/foo',
          projectType: 'library',
          release: {
            version: {
              generatorOptions: {
                bar: 'string',
                foo: true,
                o: {
                  nested2: [],
                  nested1: false,
                },
                arr: ['1', 2, false],
              },
            },
          },
          implicitDependencies: [],
          tags: [],
        },
      },
      qux: {
        name: 'qux',
        type: 'lib',
        data: {
          root: 'packages/qux',
          name: 'qux',
          targets: {
            test: {
              executor: 'nx:run-script',
              options: {
                script: 'test',
              },
              configurations: {},
            },
            'nx-release-publish': {
              dependsOn: ['^nx-release-publish'],
              executor: '@nx/js:release-publish',
              options: {},
              configurations: {},
            },
          },
          sourceRoot: 'packages/qux',
          projectType: 'library',
          release: {
            version: {
              generator: '@nx/some:other-generator',
            },
          },
          implicitDependencies: [],
          tags: [],
        },
      },
    },
  };
}
