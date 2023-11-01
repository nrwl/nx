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
            "changelog": {
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "includeAuthors": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
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
            "changelog": {
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "includeAuthors": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
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
            "changelog": {
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "includeAuthors": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
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
            "changelog": {
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "includeAuthors": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "projects": [
                  "lib-a",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
            },
          },
        }
      `);
    });

    it('should convert any projects patterns into actual project names in the final config', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        groups: {
          'group-1': {
            projects: ['lib-*'], // should match both lib-a and lib-b
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "includeAuthors": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
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
            "changelog": {
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "includeAuthors": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "projects": [
                  "lib-a",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@custom/generator",
                  "generatorOptions": {
                    "optionsOverride": "something",
                  },
                },
              },
              "group-2": {
                "changelog": false,
                "projects": [
                  "lib-b",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@custom/generator-alternative",
                  "generatorOptions": {},
                },
              },
            },
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
            },
          },
        }
      `);
    });
  });

  describe('user config -> top level version', () => {
    it('should respect modifying version at the top level and it should be inherited by the catch all group', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        version: {
          // only modifying options, use default generator
          generatorOptions: {
            foo: 'bar',
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "includeAuthors": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {
                    "foo": "bar",
                  },
                },
              },
            },
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {
                "foo": "bar",
              },
            },
          },
        }
      `);
    });
  });

  describe('user config -> top level changelog', () => {
    it('should respect disabling all changelogs at the top level', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        changelog: {
          projectChangelogs: false,
          workspaceChangelog: false,
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "projectChangelogs": false,
              "workspaceChangelog": false,
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
            },
          },
        }
      `);
    });

    it('should respect any adjustments to default changelog config at the top level and apply as defaults at the group level', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        changelog: {
          workspaceChangelog: {
            // override single field in user config
            entryWhenNoChanges: 'Custom no changes!',
          },
          projectChangelogs: {
            // override single field in user config
            file: './{projectRoot}/custom-path.md',
            renderOptions: {
              includeAuthors: false, // override deeply nested field in user config
            },
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "projectChangelogs": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                "file": "./{projectRoot}/custom-path.md",
                "renderOptions": {
                  "includeAuthors": false,
                },
                "renderer": "nx/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "Custom no changes!",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "includeAuthors": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "groups": {
              "__default__": {
                "changelog": {
                  "createRelease": false,
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "./{projectRoot}/custom-path.md",
                  "renderOptions": {
                    "includeAuthors": false,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
            },
          },
        }
      `);
    });
  });

  describe('user config -> top level and group level changelog combined', () => {
    it('should respect any adjustments to default changelog config at the top level and group level in the final config, CASE 1', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        changelog: {
          projectChangelogs: {
            // overriding field at the root should be inherited by all groups that do not set their own override
            file: './{projectRoot}/custom-path.md',
            renderOptions: {
              includeAuthors: true, // should be overridden by group level config
            },
          },
        },
        groups: {
          'group-1': {
            projects: ['lib-a'],
            changelog: {
              createRelease: 'github', // set field in group config
              renderOptions: {
                includeAuthors: false, // override deeply nested field in group config
              },
            },
          },
          'group-2': {
            projects: ['lib-b'],
            changelog: false, // disabled changelog for this group
          },
          'group-3': {
            projects: ['nx'],
            changelog: {
              file: './{projectRoot}/a-different-custom-path-at-the-group.md', // a different override field at the group level
            },
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "projectChangelogs": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                "file": "./{projectRoot}/custom-path.md",
                "renderOptions": {
                  "includeAuthors": true,
                },
                "renderer": "nx/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "includeAuthors": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "groups": {
              "group-1": {
                "changelog": {
                  "createRelease": "github",
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "./{projectRoot}/custom-path.md",
                  "renderOptions": {
                    "includeAuthors": false,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
              "group-2": {
                "changelog": false,
                "projects": [
                  "lib-b",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
              "group-3": {
                "changelog": {
                  "createRelease": false,
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "./{projectRoot}/a-different-custom-path-at-the-group.md",
                  "renderOptions": {
                    "includeAuthors": true,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "nx",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
            },
          },
        }
      `);
    });

    it('should respect any adjustments to default changelog config at the top level and group level in the final config, CASE 2', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        groups: {
          foo: {
            projects: 'lib-a',
            releaseTagPattern: '{projectName}-{version}',
          },
          bar: {
            projects: 'lib-b',
          },
        },
        changelog: {
          workspaceChangelog: {
            createRelease: 'github',
          },
          // enabling project changelogs at the workspace level should cause each group to have project changelogs enabled
          projectChangelogs: {
            createRelease: 'github',
          },
        },
      });

      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "projectChangelogs": {
                "createRelease": "github",
                "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                "file": "{projectRoot}/CHANGELOG.md",
                "renderOptions": {
                  "includeAuthors": true,
                },
                "renderer": "nx/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": "github",
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "includeAuthors": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "groups": {
              "bar": {
                "changelog": {
                  "createRelease": "github",
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "includeAuthors": true,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "lib-b",
                ],
                "releaseTagPattern": "{projectName}@v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
              "foo": {
                "changelog": {
                  "createRelease": "github",
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "includeAuthors": true,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                ],
                "releaseTagPattern": "{projectName}-{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
            },
          },
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

    it("should return an error if a group's releaseTagPattern has no {version} placeholder", async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        groups: {
          'group-1': {
            projects: '*',
            releaseTagPattern: 'v',
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "RELEASE_GROUP_RELEASE_TAG_PATTERN_VERSION_PLACEHOLDER_MISSING_OR_EXCESSIVE",
            "data": {
              "releaseGroupName": "group-1",
            },
          },
          "nxReleaseConfig": null,
        }
      `);
    });

    it("should return an error if a group's releaseTagPattern has more than one {version} placeholder", async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        groups: {
          'group-1': {
            projects: '*',
            releaseTagPattern: '{version}v{version}',
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "RELEASE_GROUP_RELEASE_TAG_PATTERN_VERSION_PLACEHOLDER_MISSING_OR_EXCESSIVE",
            "data": {
              "releaseGroupName": "group-1",
            },
          },
          "nxReleaseConfig": null,
        }
      `);
    });
  });
});
