import { type ProjectGraph } from '../../../devkit-exports';
import { createNxReleaseConfig } from './config';

describe('createNxReleaseConfig()', () => {
  let projectGraph: ProjectGraph;

  beforeEach(() => {
    projectGraph = {
      nodes: {
        'lib-a': {
          name: 'lib-a',
          type: 'lib',
          data: {
            root: 'libs/lib-a',
            targets: {
              'nx-release-publish': {},
            },
          } as any,
        },
        'lib-b': {
          name: 'lib-b',
          type: 'lib',
          data: {
            root: 'libs/lib-b',
            targets: {
              'nx-release-publish': {},
            },
          } as any,
        },
        nx: {
          name: 'nx',
          type: 'lib',
          data: {
            root: 'packages/nx',
            targets: {
              'nx-release-publish': {},
            },
          } as any,
        },
      },
      dependencies: {},
    };
  });

  describe('zero/empty user config', () => {
    it('should create appropriate default NxReleaseConfig data from zero/empty user config', async () => {
      // zero user config
      expect(await createNxReleaseConfig(projectGraph, undefined))
        .toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "groups": {
              "__default__": {
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
          },
        }
      `);

      // empty user config
      expect(await createNxReleaseConfig(projectGraph, {}))
        .toMatchInlineSnapshot(`
            {
              "error": null,
              "nxReleaseConfig": {
                "groups": {
                  "__default__": {
                    "projects": [
                      "lib-a",
                      "lib-b",
                      "nx",
                    ],
                    "version": {
                      "generator": "@nx/js:release-version",
                      "generatorOptions": {},
                    },
                  },
                },
              },
            }
        `);

      // empty groups
      expect(
        await createNxReleaseConfig(projectGraph, {
          groups: {},
        })
      ).toMatchInlineSnapshot(`
            {
              "error": null,
              "nxReleaseConfig": {
                "groups": {
                  "__default__": {
                    "projects": [
                      "lib-a",
                      "lib-b",
                      "nx",
                    ],
                    "version": {
                      "generator": "@nx/js:release-version",
                      "generatorOptions": {},
                    },
                  },
                },
              },
            }
        `);
    });
  });

  describe('user specified groups', () => {
    it('should ignore any projects not matched to user specified groups', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        groups: {
          'group-1': {
            projects: ['lib-a'], // intentionally no lib-b, so it should be ignored
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "groups": {
              "group-1": {
                "projects": [
                  "lib-a",
                ],
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
          },
        }
      `);
    });

    it('should respect user overrides for "version" config at the group level', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        groups: {
          'group-1': {
            projects: ['lib-a'],
            version: {
              generator: '@custom/generator',
              generatorOptions: {
                optionsOverride: 'something',
              },
            },
          },
          'group-2': {
            projects: ['lib-b'],
            version: {
              generator: '@custom/generator-alternative',
            },
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "groups": {
              "group-1": {
                "projects": [
                  "lib-a",
                ],
                "version": {
                  "generator": "@custom/generator",
                  "generatorOptions": {
                    "optionsOverride": "something",
                  },
                },
              },
              "group-2": {
                "projects": [
                  "lib-b",
                ],
                "version": {
                  "generator": "@custom/generator-alternative",
                  "generatorOptions": {},
                },
              },
            },
          },
        }
      `);
    });
  });

  describe('release group config errors', () => {
    it('should return an error if a project matches multiple groups', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        groups: {
          'group-1': {
            projects: ['lib-a'],
          },
          'group-2': {
            projects: ['lib-a'],
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "PROJECT_MATCHES_MULTIPLE_GROUPS",
            "data": {
              "project": "lib-a",
            },
          },
          "nxReleaseConfig": null,
        }
      `);
    });

    it('should return an error if no projects can be resolved for a group', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        groups: {
          'group-1': {
            projects: ['lib-does-not-exist'],
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "RELEASE_GROUP_MATCHES_NO_PROJECTS",
            "data": {
              "releaseGroupName": "group-1",
            },
          },
          "nxReleaseConfig": null,
        }
      `);
    });

    it('should return an error if any matched projects do not have the required target specified', async () => {
      const res = await createNxReleaseConfig(
        {
          ...projectGraph,
          nodes: {
            ...projectGraph.nodes,
            'project-without-target': {
              name: 'project-without-target',
              type: 'lib',
              data: {
                root: 'libs/project-without-target',
                targets: {},
              } as any,
            },
          },
        },
        {
          groups: {
            'group-1': {
              projects: '*', // using string form to ensure that is supported in addition to array form
            },
          },
        },
        'nx-release-publish'
      );
      expect(res).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "PROJECTS_MISSING_TARGET",
            "data": {
              "projects": [
                "project-without-target",
              ],
              "targetName": "nx-release-publish",
            },
          },
          "nxReleaseConfig": null,
        }
      `);

      const res2 = await createNxReleaseConfig(
        {
          ...projectGraph,
          nodes: {
            ...projectGraph.nodes,
            'another-project-without-target': {
              name: 'another-project-without-target',
              type: 'lib',
              data: {
                root: 'libs/another-project-without-target',
                targets: {},
              } as any,
            },
          },
        },
        {},
        'nx-release-publish'
      );
      expect(res2).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "PROJECTS_MISSING_TARGET",
            "data": {
              "projects": [
                "another-project-without-target",
              ],
              "targetName": "nx-release-publish",
            },
          },
          "nxReleaseConfig": null,
        }
      `);
    });
  });
});
