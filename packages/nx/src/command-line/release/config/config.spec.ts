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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
              "stageChanges": false,
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
                  "conventionalCommits": false,
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
                  "conventionalCommits": false,
                  "generator": "@custom/generator-alternative",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "renderer": "nx/release/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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

    it('should disable workspaceChangelog if there are multiple groups', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        groups: {
          'group-1': {
            projects: ['lib-a'],
            changelog: true,
          },
          'group-2': {
            projects: ['lib-b'],
            changelog: true,
          },
        },
      });

      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
              "stageChanges": false,
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
                  "renderer": "nx/release/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
              "group-2": {
                "changelog": {
                  "createRelease": false,
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "nx/release/changelog-renderer",
                },
                "projects": [
                  "lib-b",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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

    it('should disable workspaceChangelog if the single group has an independent projects relationship', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        groups: {
          'group-1': {
            projects: ['lib-a', 'lib-b'],
            projectsRelationship: 'independent',
            changelog: true,
          },
        },
      });

      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
              "stageChanges": false,
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
                  "renderer": "nx/release/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                  "lib-b",
                ],
                "projectsRelationship": "independent",
                "releaseTagPattern": "{projectName}@{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
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
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "--no-verify",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": true,
              "commitArgs": "--no-verify",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
        version: {
          git: {
            commit: true,
            commitArgs: '--no-verify',
            tag: true,
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "{projectName}__{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "renderer": "nx/release/changelog-renderer",
                },
                "projects": [
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "{version}",
                "version": {
                  "conventionalCommits": false,
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
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "renderer": "nx/release/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "renderer": "nx/release/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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

    it('should respect disabling git at the top level (thus disabling the default of true for changelog', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        git: {
          commit: false,
          tag: false,
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
              "workspaceChangelog": false,
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "renderer": "nx/release/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "conventionalCommits": false,
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
                  "conventionalCommits": false,
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
                  "renderer": "nx/release/changelog-renderer",
                },
                "projects": [
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
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
                  "renderer": "nx/release/changelog-renderer",
                },
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "{projectName}-{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
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
  });

  describe('user config -> mixed top level and granular git', () => {
    it('should return an error with version config and top level config', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        git: {
          commit: true,
          tag: false,
        },
        version: {
          git: {
            commit: false,
            tag: true,
          },
        },
      });

      expect(res).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "GLOBAL_GIT_CONFIG_MIXED_WITH_GRANULAR_GIT_CONFIG",
            "data": {},
          },
          "nxReleaseConfig": null,
        }
      `);
    });

    it('should return an error with changelog config and top level config', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        git: {
          commit: true,
          tag: false,
        },
        changelog: {
          git: {
            commit: false,
            tag: true,
          },
        },
      });

      expect(res).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "GLOBAL_GIT_CONFIG_MIXED_WITH_GRANULAR_GIT_CONFIG",
            "data": {},
          },
          "nxReleaseConfig": null,
        }
      `);
    });

    it('should return an error with version and changelog config and top level config', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        git: {
          commit: true,
          tag: false,
        },
        version: {
          git: {
            commit: false,
            tag: true,
          },
        },
        changelog: {
          git: {
            commit: true,
            tag: false,
          },
        },
      });

      expect(res).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "GLOBAL_GIT_CONFIG_MIXED_WITH_GRANULAR_GIT_CONFIG",
            "data": {},
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
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
              "stageChanges": false,
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
                  "conventionalCommits": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "independent",
            "releaseTagPattern": "{projectName}@{version}",
            "version": {
              "conventionalCommits": false,
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

    it('should override workspaceChangelog default if projectsRelationship is independent', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        projectsRelationship: 'independent',
        projects: ['lib-a', 'lib-b'],
      });

      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
              "stageChanges": false,
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
                ],
                "projectsRelationship": "independent",
                "releaseTagPattern": "{projectName}@{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "independent",
            "releaseTagPattern": "{projectName}@{version}",
            "version": {
              "conventionalCommits": false,
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

  describe('version.conventionalCommits shorthand', () => {
    it('should be implicitly false and not interfere with its long-form equivalent generatorOptions when not explicitly set', async () => {
      const res1 = await createNxReleaseConfig(projectGraph, {
        version: {
          generatorOptions: {
            currentVersionResolver: 'git-tag',
            specifierSource: 'conventional-commits',
          },
        },
      });
      expect(res1).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {
                    "currentVersionResolver": "git-tag",
                    "specifierSource": "conventional-commits",
                  },
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
              "generator": "@nx/js:release-version",
              "generatorOptions": {
                "currentVersionResolver": "git-tag",
                "specifierSource": "conventional-commits",
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

      const res2 = await createNxReleaseConfig(projectGraph, {
        version: {
          generatorOptions: {
            currentVersionResolver: 'registry',
            specifierSource: 'prompt',
          },
        },
      });
      expect(res2).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {
                    "currentVersionResolver": "registry",
                    "specifierSource": "prompt",
                  },
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
              "generator": "@nx/js:release-version",
              "generatorOptions": {
                "currentVersionResolver": "registry",
                "specifierSource": "prompt",
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

    it('should update appropriate default values for generatorOptions when applied at the root', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        version: {
          conventionalCommits: true,
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": true,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {
                    "currentVersionResolver": "git-tag",
                    "specifierSource": "conventional-commits",
                  },
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": true,
              "generator": "@nx/js:release-version",
              "generatorOptions": {
                "currentVersionResolver": "git-tag",
                "specifierSource": "conventional-commits",
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

    it('should be possible to override at the group level and produce the appropriate default generatorOptions', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        version: {
          conventionalCommits: true,
        },
        groups: {
          'group-1': {
            projects: 'nx',
            version: {
              conventionalCommits: false,
            },
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "projects": [
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": true,
              "generator": "@nx/js:release-version",
              "generatorOptions": {
                "currentVersionResolver": "git-tag",
                "specifierSource": "conventional-commits",
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

    it('should not error if the shorthand is combined with unrelated generatorOptions', async () => {
      const res = await createNxReleaseConfig(projectGraph, {
        version: {
          conventionalCommits: true,
          generatorOptions: {
            someUnrelatedOption: 'foobar',
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "stageChanges": false,
                "tag": true,
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
                "renderer": "nx/release/changelog-renderer",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "stageChanges": false,
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
                  "conventionalCommits": true,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {
                    "currentVersionResolver": "git-tag",
                    "someUnrelatedOption": "foobar",
                    "specifierSource": "conventional-commits",
                  },
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": true,
              "generator": "@nx/js:release-version",
              "generatorOptions": {
                "currentVersionResolver": "git-tag",
                "someUnrelatedOption": "foobar",
                "specifierSource": "conventional-commits",
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

    it('should error if the shorthand is combined with related generatorOptions', async () => {
      const res1 = await createNxReleaseConfig(projectGraph, {
        version: {
          conventionalCommits: true,
          generatorOptions: {
            specifierSource: 'prompt',
          },
        },
      });
      expect(res1).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "CONVENTIONAL_COMMITS_SHORTHAND_MIXED_WITH_OVERLAPPING_GENERATOR_OPTIONS",
            "data": {},
          },
          "nxReleaseConfig": null,
        }
      `);

      const res2 = await createNxReleaseConfig(projectGraph, {
        version: {
          conventionalCommits: true,
          generatorOptions: {
            currentVersionResolver: 'registry',
          },
        },
      });
      expect(res2).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "CONVENTIONAL_COMMITS_SHORTHAND_MIXED_WITH_OVERLAPPING_GENERATOR_OPTIONS",
            "data": {},
          },
          "nxReleaseConfig": null,
        }
      `);
    });
  });
});
