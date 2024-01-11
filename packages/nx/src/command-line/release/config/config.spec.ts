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
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
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
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
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
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
            },
          },
        }
      `);
    });

    it('should filter out app and e2e projects', async () => {
      projectGraph.nodes['app-1'] = {
        name: 'app-1',
        type: 'app',
        data: {
          root: 'apps/app-1',
          targets: {},
        } as any,
      };

      projectGraph.nodes['e2e-1'] = {
        name: 'e2e-1',
        type: 'e2e',
        data: {
          root: 'apps/e2e-1',
          targets: {},
        } as any,
      };

      expect(await createNxReleaseConfig(projectGraph, undefined))
        .toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
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
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
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
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
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
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
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
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@custom/generator-alternative",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
            },
          },
        }
      `);
    });

    it('should allow using true for group level changelog as an equivalent of an empty object (i.e. use the defaults)', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        groups: {
          'group-1': {
            projects: ['lib-a'],
            changelog: true,
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": {
                  "createRelease": false,
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
            },
          },
        }
      `);
    });
  });

  describe('user config -> top level version', () => {
    it('should respect modifying version at the top level and it should be inherited by the implicit default group', async () => {
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
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {
                    "foo": "bar",
                  },
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {
                "foo": "bar",
              },
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
            },
          },
        }
      `);
    });

    it('should respect enabling git operations on the version command via the top level', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        git: {
          commit: true,
          commitArgs: '--no-verify',
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "git": {
                "commit": true,
                "commitArgs": "--no-verify",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": true,
              "commitArgs": "--no-verify",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": true,
                "commitArgs": "--no-verify",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
            },
          },
        }
      `);
    });

    it('should respect enabling git operations for the version command directly', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        git: {
          tag: false,
        },
        version: {
          git: {
            commit: true,
            commitArgs: '--no-verify',
            tag: true, // should take priority over top level
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": true,
                "commitArgs": "--no-verify",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": true,
                "tagArgs": "",
                "tagMessage": "",
              },
            },
          },
        }
      `);
    });
  });

  describe('user config -> top level projects', () => {
    it('should return an error when both "projects" and "groups" are specified', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        projects: ['lib-a'],
        groups: {
          'group-1': {
            projects: ['lib-a'],
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "PROJECTS_AND_GROUPS_DEFINED",
            "data": {},
          },
          "nxReleaseConfig": null,
        }
      `);
    });

    it('should influence the projects configured for the implicit default group', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        projects: ['lib-a'],
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
            },
          },
        }
      `);
    });
  });

  describe('user config -> top level releaseTagPattern', () => {
    it('should respect modifying releaseTagPattern at the top level and it should be inherited by the implicit default group', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        releaseTagPattern: '{projectName}__{version}',
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "{projectName}__{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "{projectName}__{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
            },
          },
        }
      `);
    });

    it('should respect top level releaseTagPatterns for fixed groups without explicit settings of their own', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        releaseTagPattern: '{version}',
        groups: {
          npm: {
            projects: ['nx'],
            version: {
              generatorOptions: {
                currentVersionResolver: 'git-tag',
                specifierSource: 'conventional-commits',
              },
            },
            changelog: true,
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "npm": {
                "changelog": {
                  "createRelease": false,
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {
                    "currentVersionResolver": "git-tag",
                    "specifierSource": "conventional-commits",
                  },
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
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
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": false,
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
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
              authors: false, // override deeply nested field in user config
              commitReferences: false, // override deeply nested field in user config
            },
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                "file": "./{projectRoot}/custom-path.md",
                "renderOptions": {
                  "authors": false,
                  "commitReferences": false,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "Custom no changes!",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": {
                  "createRelease": false,
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "./{projectRoot}/custom-path.md",
                  "renderOptions": {
                    "authors": false,
                    "commitReferences": false,
                    "versionTitleDate": true,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
            },
          },
        }
      `);
    });

    it('should allow using true for workspaceChangelog and projectChangelogs as an equivalent of an empty object (i.e. use the defaults)', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        changelog: {
          projectChangelogs: true,
          workspaceChangelog: true,
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                "file": "{projectRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": {
                  "createRelease": false,
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
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
              authors: true, // should be overridden by group level config
            },
          },
        },
        groups: {
          'group-1': {
            projects: ['lib-a'],
            changelog: {
              createRelease: 'github', // set field in group config
              renderOptions: {
                authors: false, // override deeply nested field in group config
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
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                "file": "./{projectRoot}/custom-path.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": {
                  "createRelease": "github",
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "./{projectRoot}/custom-path.md",
                  "renderOptions": {
                    "authors": false,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
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
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
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
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
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
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": {
                "createRelease": "github",
                "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                "file": "{projectRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": "github",
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "bar": {
                "changelog": {
                  "createRelease": "github",
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "lib-b",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
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
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "nx/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "{projectName}-{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
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

  describe('projectsRelationship at the root', () => {
    it('should respect the user specified projectsRelationship value and apply it to any groups that do not specify their own value', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        projectsRelationship: 'independent',
        groups: {
          'group-1': {
            projects: 'lib-a',
            // no explicit value, should inherit from top level
          },
          'group-2': {
            projects: ['lib-b', 'nx'],
            projectsRelationship: 'fixed', // should not be overridden by top level
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "nx/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "independent",
                "releaseTagPattern": "{projectName}@{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
              "group-2": {
                "changelog": false,
                "projects": [
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "independent",
            "releaseTagPattern": "{projectName}@{version}",
            "version": {
              "generator": "@nx/js:release-version",
              "generatorOptions": {},
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
            },
          },
        }
      `);
    });
  });
});
