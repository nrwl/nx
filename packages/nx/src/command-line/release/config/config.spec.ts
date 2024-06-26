import { join } from 'path';
import { ProjectFileMap, ProjectGraph } from '../../../config/project-graph';
import { TempFs } from '../../../internal-testing-utils/temp-fs';
import { createNxReleaseConfig } from './config';

expect.addSnapshotSerializer({
  serialize: (str: string) => {
    // replace all instances of the workspace root with a placeholder to ensure consistency
    return JSON.stringify(
      str.replaceAll(
        new RegExp(join(__dirname, '../../../..').replace(/\\/g, '\\\\'), 'g'),
        '<dirname>'
      )
    );
  },
  test(val: string) {
    return (
      val != null &&
      typeof val === 'string' &&
      val.includes(join(__dirname, '../../../..'))
    );
  },
});

describe('createNxReleaseConfig()', () => {
  let projectGraph: ProjectGraph;
  let projectFileMap: ProjectFileMap;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('nx-release-config-test');
    await tempFs.createFiles({
      'package.json': JSON.stringify({
        name: 'root',
        version: '0.0.0',
        private: true,
      }),
      'libs/lib-a/package.json': JSON.stringify({
        name: 'lib-a',
        version: '0.0.0',
      }),
      'libs/lib-b/package.json': JSON.stringify({
        name: 'lib-b',
        version: '0.0.0',
      }),
      'packages/nx/package.json': JSON.stringify({
        name: 'nx',
        version: '0.0.0',
      }),
    });
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
        root: {
          name: 'root',
          type: 'lib',
          data: {
            root: '.',
            targets: {
              'nx-release-publish': {},
            },
          } as any,
        },
      },
      dependencies: {},
    };

    projectFileMap = {
      'lib-a': [
        {
          file: 'libs/lib-a/package.json',
          hash: 'abc',
        },
      ],
      'lib-b': [
        {
          file: 'libs/lib-b/package.json',
          hash: 'abc',
        },
      ],
      nx: [
        {
          file: 'packages/nx/package.json',
          hash: 'abc',
        },
      ],
      root: [
        {
          file: 'package.json',
          hash: 'abc',
        },
      ],
    };
  });

  describe('zero/empty user config', () => {
    it('should create appropriate default NxReleaseConfig data from zero/empty user config', async () => {
      // zero user config
      expect(
        await createNxReleaseConfig(projectGraph, projectFileMap, undefined)
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);

      // empty user config
      expect(await createNxReleaseConfig(projectGraph, projectFileMap, {}))
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);

      // empty groups
      expect(
        await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
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

      projectFileMap['app-1'] = [
        {
          file: 'apps/app-1/package.json',
          hash: 'abc',
        },
      ];

      projectFileMap['e2e-1'] = [
        {
          file: 'apps/e2e-1/package.json',
          hash: 'abc',
        },
      ];

      expect(
        await createNxReleaseConfig(projectGraph, projectFileMap, undefined)
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should filter out projects without package.json', async () => {
      projectGraph.nodes['lib-c'] = {
        name: 'lib-c',
        type: 'lib',
        data: {
          root: 'libs/lib-c',
          targets: {},
        } as any,
      };

      projectFileMap['lib-c'] = [
        {
          file: 'libs/lib-c/cargo.toml',
          hash: 'abc',
        },
      ];

      expect(
        await createNxReleaseConfig(projectGraph, projectFileMap, undefined)
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should filter out projects that are private', async () => {
      projectGraph.nodes['root'] = {
        name: 'root',
        type: 'lib',
        data: {
          root: '.',
          targets: {},
        } as any,
      };

      projectFileMap['root'] = [
        {
          file: 'package.json',
          hash: 'abc',
        },
      ];

      tempFs.writeFile(
        'package.json',
        JSON.stringify({ name: 'root', version: '0.0.0', private: true })
      );
      tempFs.writeFile(
        'libs/lib-a/package.json',
        JSON.stringify({ name: 'lib-a', version: '0.0.0', private: true })
      );

      expect(
        await createNxReleaseConfig(projectGraph, projectFileMap, undefined)
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should not filter out the root project if it is not private', async () => {
      projectGraph.nodes['root'] = {
        name: 'root',
        type: 'lib',
        data: {
          root: '.',
          targets: {},
        } as any,
      };

      projectFileMap['root'] = [
        {
          file: 'package.json',
          hash: 'abc',
        },
      ];

      tempFs.writeFile(
        'package.json',
        JSON.stringify({
          name: 'root',
          version: '0.0.0',
        })
      );

      expect(
        await createNxReleaseConfig(projectGraph, projectFileMap, undefined)
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                  "root",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });
  });

  describe('user specified groups', () => {
    it('should ignore any projects not matched to user specified groups', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should convert any projects patterns into actual project names in the final config', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should respect user overrides for "version" config at the group level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                  "generator": "@custom/generator",
                  "generatorOptions": {
                    "optionsOverride": "something",
                  },
                },
                "versionPlans": false,
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow using true for group level changelog as an equivalent of an empty object (i.e. use the defaults)', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                    "mapAuthorsToGitHubUsernames": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should disable workspaceChangelog if there are multiple groups', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                    "mapAuthorsToGitHubUsernames": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
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
                "versionPlans": false,
              },
              "group-2": {
                "changelog": {
                  "createRelease": false,
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "authors": true,
                    "commitReferences": true,
                    "mapAuthorsToGitHubUsernames": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should disable workspaceChangelog if the single group has an independent projects relationship', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                    "mapAuthorsToGitHubUsernames": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });
  });

  describe('user config -> top level version', () => {
    it('should respect modifying version at the top level and it should be inherited by the implicit default group', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should respect enabling git operations on the version command via the top level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should respect enabling git operations for the version command directly', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow configuration of preVersionCommand', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        version: {
          preVersionCommand: 'nx run-many -t build',
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "nx run-many -t build",
            },
            "versionPlans": false,
          },
        }
      `);
    });
  });

  describe('user config -> top level projects', () => {
    it('should return an error when both "projects" and "groups" are specified', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });
  });

  describe('user config -> top level releaseTagPattern', () => {
    it('should respect modifying releaseTagPattern at the top level and it should be inherited by the implicit default group', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should respect top level releaseTagPatterns for fixed groups without explicit settings of their own', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                    "mapAuthorsToGitHubUsernames": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });
  });

  describe('user config -> top level changelog', () => {
    it('should respect disabling all changelogs at the top level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should respect any adjustments to default changelog config at the top level and apply as defaults at the group level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "Custom no changes!",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                    "mapAuthorsToGitHubUsernames": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow using true for workspaceChangelog and projectChangelogs as an equivalent of an empty object (i.e. use the defaults)', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                    "mapAuthorsToGitHubUsernames": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should respect disabling git at the top level (thus disabling the default of true for changelog', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });
  });

  describe('user config -> top level conventional commits configuration', () => {
    it('should use defaults when config is empty', async () => {
      const res1 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        conventionalCommits: {},
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);

      const res2 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        conventionalCommits: {
          types: {},
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should merge defaults with overrides and new commit types', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        conventionalCommits: {
          types: {
            feat: {
              changelog: {
                hidden: true,
              },
            },
            chore: {
              semverBump: 'patch',
              changelog: {
                title: 'Custom Chore Title',
                hidden: false,
              },
            },
            customType: {
              semverBump: 'major',
              changelog: {
                title: 'Custom Type Title',
              },
            },
            customTypeWithDefaults: {},
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": false,
                    "title": "Custom Chore Title",
                  },
                  "semverBump": "patch",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "customType": {
                  "changelog": {
                    "hidden": false,
                    "title": "Custom Type Title",
                  },
                  "semverBump": "major",
                },
                "customTypeWithDefaults": {
                  "changelog": {
                    "hidden": false,
                    "title": "customTypeWithDefaults",
                  },
                  "semverBump": "patch",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": true,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should parse shorthand for disabling a commit type', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        conventionalCommits: {
          types: {
            feat: false,
            customType: false,
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "customType": {
                  "changelog": {
                    "hidden": true,
                    "title": "customType",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": true,
                    "title": "🚀 Features",
                  },
                  "semverBump": "none",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should parse shorthand for enabling a commit type', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        conventionalCommits: {
          types: {
            feat: true,
            fix: true,
            perf: true,
            docs: true,
            customType: true,
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "customType": {
                  "changelog": {
                    "hidden": false,
                    "title": "customType",
                  },
                  "semverBump": "patch",
                },
                "docs": {
                  "changelog": {
                    "hidden": false,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "patch",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "patch",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should parse shorthand for disabling changelog appearance for a commit type', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        conventionalCommits: {
          types: {
            fix: {
              changelog: false,
            },
            customType: {
              changelog: false,
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "customType": {
                  "changelog": {
                    "hidden": true,
                    "title": "customType",
                  },
                  "semverBump": "patch",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": true,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should parse shorthand for enabling changelog appearance for a commit type', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        conventionalCommits: {
          types: {
            fix: {
              changelog: true,
            },
            docs: {
              changelog: true,
            },
            customType: {
              changelog: true,
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "customType": {
                  "changelog": {
                    "hidden": false,
                    "title": "customType",
                  },
                  "semverBump": "patch",
                },
                "docs": {
                  "changelog": {
                    "hidden": false,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "patch",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });
  });

  describe('user config -> top level and group level changelog combined', () => {
    it('should respect any adjustments to default changelog config at the top level and group level in the final config, CASE 1', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                mapAuthorsToGitHubUsernames: false, // override deeply nested field in group config
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
              "workspaceChangelog": false,
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                  "createRelease": "github",
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "./{projectRoot}/custom-path.md",
                  "renderOptions": {
                    "authors": false,
                    "commitReferences": true,
                    "mapAuthorsToGitHubUsernames": false,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
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
                "versionPlans": false,
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
                "versionPlans": false,
              },
              "group-3": {
                "changelog": {
                  "createRelease": false,
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "./{projectRoot}/a-different-custom-path-at-the-group.md",
                  "renderOptions": {
                    "authors": true,
                    "commitReferences": true,
                    "mapAuthorsToGitHubUsernames": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should respect any adjustments to default changelog config at the top level and group level in the final config, CASE 2', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": "github",
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                    "mapAuthorsToGitHubUsernames": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should return an error if no projects can be resolved for a group', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "projectsRelationship": "independent",
                "releaseTagPattern": "{projectName}@{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
                "versionPlans": false,
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should override workspaceChangelog default if projectsRelationship is independent', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                ],
                "projectsRelationship": "independent",
                "releaseTagPattern": "{projectName}@{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });
  });

  describe('version.conventionalCommits shorthand', () => {
    it('should be implicitly false and not interfere with its long-form equivalent generatorOptions when not explicitly set', async () => {
      const res1 = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);

      const res2 = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should update appropriate default values for generatorOptions when applied at the root', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should be possible to override at the group level and produce the appropriate default generatorOptions', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should not error if the shorthand is combined with unrelated generatorOptions', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should error if the shorthand is combined with related generatorOptions', async () => {
      const res1 = await createNxReleaseConfig(projectGraph, projectFileMap, {
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

      const res2 = await createNxReleaseConfig(projectGraph, projectFileMap, {
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

  describe('versionPlans shorthand', () => {
    it('should respect user "versionPlans" set at root level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        versionPlans: true,
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
                  "mapAuthorsToGitHubUsernames": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                    "specifierSource": "version-plans",
                  },
                },
                "versionPlans": true,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
              "generator": "@nx/js:release-version",
              "generatorOptions": {
                "specifierSource": "version-plans",
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
              "preVersionCommand": "",
            },
            "versionPlans": true,
          },
        }
      `);
    });

    it('should respect user "versionPlans" set at group level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          'group-1': {
            projects: 'nx',
            versionPlans: true,
          },
          'group-2': {
            projects: 'lib-a',
            versionPlans: false,
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
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                  "generatorOptions": {
                    "specifierSource": "version-plans",
                  },
                },
                "versionPlans": true,
              },
              "group-2": {
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
                "versionPlans": false,
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
              "preVersionCommand": "",
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should override "versionPlans" with false when set at the group level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        versionPlans: true,
        groups: {
          'group-1': {
            projects: 'nx',
            versionPlans: false,
          },
          'group-2': {
            projects: 'lib-a',
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
            "conventionalCommits": {
              "types": {
                "build": {
                  "changelog": {
                    "hidden": true,
                    "title": "📦 Build",
                  },
                  "semverBump": "none",
                },
                "chore": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏡 Chore",
                  },
                  "semverBump": "none",
                },
                "ci": {
                  "changelog": {
                    "hidden": true,
                    "title": "🤖 CI",
                  },
                  "semverBump": "none",
                },
                "docs": {
                  "changelog": {
                    "hidden": true,
                    "title": "📖 Documentation",
                  },
                  "semverBump": "none",
                },
                "examples": {
                  "changelog": {
                    "hidden": true,
                    "title": "🏀 Examples",
                  },
                  "semverBump": "none",
                },
                "feat": {
                  "changelog": {
                    "hidden": false,
                    "title": "🚀 Features",
                  },
                  "semverBump": "minor",
                },
                "fix": {
                  "changelog": {
                    "hidden": false,
                    "title": "🩹 Fixes",
                  },
                  "semverBump": "patch",
                },
                "perf": {
                  "changelog": {
                    "hidden": false,
                    "title": "🔥 Performance",
                  },
                  "semverBump": "none",
                },
                "refactor": {
                  "changelog": {
                    "hidden": true,
                    "title": "💅 Refactors",
                  },
                  "semverBump": "none",
                },
                "revert": {
                  "changelog": {
                    "hidden": true,
                    "title": "⏪ Revert",
                  },
                  "semverBump": "none",
                },
                "style": {
                  "changelog": {
                    "hidden": true,
                    "title": "🎨 Styles",
                  },
                  "semverBump": "none",
                },
                "test": {
                  "changelog": {
                    "hidden": true,
                    "title": "✅ Tests",
                  },
                  "semverBump": "none",
                },
                "types": {
                  "changelog": {
                    "hidden": true,
                    "title": "🌊 Types",
                  },
                  "semverBump": "none",
                },
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
                "versionPlans": false,
              },
              "group-2": {
                "changelog": false,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTagPattern": "v{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {
                    "specifierSource": "version-plans",
                  },
                },
                "versionPlans": true,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "v{version}",
            "version": {
              "conventionalCommits": false,
              "generator": "@nx/js:release-version",
              "generatorOptions": {
                "specifierSource": "version-plans",
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
              "preVersionCommand": "",
            },
            "versionPlans": true,
          },
        }
      `);
    });
  });
});
