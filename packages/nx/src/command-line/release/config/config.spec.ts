import { join } from 'path';
import type {
  ProjectFileMap,
  ProjectGraph,
} from '../../../config/project-graph';
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
        'lib-c': {
          name: 'lib-c',
          type: 'lib',
          data: {
            root: 'libs/lib-c',
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
      'lib-c': [
        {
          file: 'libs/lib-c/package.json',
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                  "root",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "lib-c",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
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
                    "applyUsernameToAuthors": true,
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
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
                    "applyUsernameToAuthors": true,
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-2": {
                "changelog": {
                  "createRelease": false,
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "applyUsernameToAuthors": true,
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "lib-b",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
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
                    "applyUsernameToAuthors": true,
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                ],
                "projectsRelationship": "independent",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{projectName}@{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should respect override for releaseTagPatternRequireSemver at group level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          'group-1': {
            projects: ['lib-a'],
            releaseTagPatternRequireSemver: true,
          },
          'group-2': {
            projects: ['lib-b'],
            releaseTagPatternRequireSemver: false,
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
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "releaseTagPatternRequireSemver": true,
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-2": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-b",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "releaseTagPatternRequireSemver": false,
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow groups to define their own docker options', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          'group-1': {
            projects: ['lib-a'],
            docker: {
              versionSchemes: {
                production: '{currentDate|YYMM.DD}.{shortCommitSha}',
                hotfix: '{currentDate|YYMM.DD}-hotfix',
              },
            },
          },
          'group-2': {
            projects: ['lib-b'],
            docker: {
              versionSchemes: {
                production: '{currentDate|YY.MM.DD}',
                hotfix: '{currentDate|YYMM.DD}.{shortCommitSha}-hotfix',
              },
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
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": {
                  "groupPreVersionCommand": "",
                  "versionSchemes": {
                    "hotfix": "{currentDate|YYMM.DD}-hotfix",
                    "production": "{currentDate|YYMM.DD}.{shortCommitSha}",
                  },
                },
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": true,
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-2": {
                "changelog": false,
                "docker": {
                  "groupPreVersionCommand": "",
                  "versionSchemes": {
                    "hotfix": "{currentDate|YYMM.DD}.{shortCommitSha}-hotfix",
                    "production": "{currentDate|YY.MM.DD}",
                  },
                },
                "projects": [
                  "lib-b",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": true,
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow groups to define their own docker groupPreVersionCommand', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          'group-1': {
            projects: ['lib-a'],
            docker: {
              versionSchemes: {
                production: '{currentDate|YYMM.DD}.{shortCommitSha}',
                hotfix: '{currentDate|YYMM.DD}-hotfix',
              },
              groupPreVersionCommand: 'npx nx run-many -t docker-build',
            },
          },
          'group-2': {
            projects: ['lib-b'],
            docker: {
              versionSchemes: {
                production: '{currentDate|YY.MM.DD}',
                hotfix: '{currentDate|YYMM.DD}.{shortCommitSha}-hotfix',
              },
              groupPreVersionCommand: 'npx nx run-many -t docker:build',
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
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": {
                  "groupPreVersionCommand": "npx nx run-many -t docker-build",
                  "versionSchemes": {
                    "hotfix": "{currentDate|YYMM.DD}-hotfix",
                    "production": "{currentDate|YYMM.DD}.{shortCommitSha}",
                  },
                },
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": true,
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-2": {
                "changelog": false,
                "docker": {
                  "groupPreVersionCommand": "npx nx run-many -t docker:build",
                  "versionSchemes": {
                    "hotfix": "{currentDate|YYMM.DD}.{shortCommitSha}-hotfix",
                    "production": "{currentDate|YY.MM.DD}",
                  },
                },
                "projects": [
                  "lib-b",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": true,
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should not apply top level prevserion command to docker groups', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        version: {
          preVersionCommand: 'npx nx run-many -t build',
        },
        groups: {
          'group-1': {
            projects: ['lib-a'],
            docker: {
              versionSchemes: {
                production: '{currentDate|YYMM.DD}.{shortCommitSha}',
                hotfix: '{currentDate|YYMM.DD}-hotfix',
              },
              groupPreVersionCommand: 'npx nx run-many -t docker-build',
            },
          },
          'group-2': {
            projects: ['lib-b'],
            docker: {
              versionSchemes: {
                production: '{currentDate|YY.MM.DD}',
                hotfix: '{currentDate|YYMM.DD}.{shortCommitSha}-hotfix',
              },
              groupPreVersionCommand: 'npx nx run-many -t docker:build',
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
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": {
                  "groupPreVersionCommand": "npx nx run-many -t docker-build",
                  "versionSchemes": {
                    "hotfix": "{currentDate|YYMM.DD}-hotfix",
                    "production": "{currentDate|YYMM.DD}.{shortCommitSha}",
                  },
                },
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": true,
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-2": {
                "changelog": false,
                "docker": {
                  "groupPreVersionCommand": "npx nx run-many -t docker:build",
                  "versionSchemes": {
                    "hotfix": "{currentDate|YYMM.DD}.{shortCommitSha}-hotfix",
                    "production": "{currentDate|YY.MM.DD}",
                  },
                },
                "projects": [
                  "lib-b",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": true,
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "npx nx run-many -t build",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow groups to specify releaseTagPatternPreferDockerVersion specifically', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          'group-1': {
            projects: ['lib-a'],
            docker: {
              versionSchemes: {
                production: '{currentDate|YYMM.DD}.{shortCommitSha}',
                hotfix: '{currentDate|YYMM.DD}-hotfix',
              },
            },
            releaseTagPatternPreferDockerVersion: true,
          },
          'group-2': {
            projects: ['lib-b'],
            docker: {
              versionSchemes: {
                production: '{currentDate|YY.MM.DD}',
                hotfix: '{currentDate|YYMM.DD}.{shortCommitSha}-hotfix',
              },
            },
            releaseTagPatternPreferDockerVersion: false,
          },
          'group-3': {
            projects: ['lib-c'],
            docker: {
              versionSchemes: {
                production: '{currentDate|YY.MM.DD}',
                hotfix: '{currentDate|YYMM.DD}.{shortCommitSha}-hotfix',
              },
            },
            releaseTagPatternPreferDockerVersion: 'both',
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
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": {
                  "groupPreVersionCommand": "",
                  "versionSchemes": {
                    "hotfix": "{currentDate|YYMM.DD}-hotfix",
                    "production": "{currentDate|YYMM.DD}.{shortCommitSha}",
                  },
                },
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": true,
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "releaseTagPatternPreferDockerVersion": true,
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-2": {
                "changelog": false,
                "docker": {
                  "groupPreVersionCommand": "",
                  "versionSchemes": {
                    "hotfix": "{currentDate|YYMM.DD}.{shortCommitSha}-hotfix",
                    "production": "{currentDate|YY.MM.DD}",
                  },
                },
                "projects": [
                  "lib-b",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "releaseTagPatternPreferDockerVersion": false,
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-3": {
                "changelog": false,
                "docker": {
                  "groupPreVersionCommand": "",
                  "versionSchemes": {
                    "hotfix": "{currentDate|YYMM.DD}.{shortCommitSha}-hotfix",
                    "production": "{currentDate|YY.MM.DD}",
                  },
                },
                "projects": [
                  "lib-c",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": "both",
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "releaseTagPatternPreferDockerVersion": "both",
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
          // only modifying options
          conventionalCommits: false,
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": true,
              "commitArgs": "--no-verify",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": true,
                "commitArgs": "--no-verify",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": true,
                "commitArgs": "--no-verify",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": true,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "nx run-many -t build",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow configuration of preVersionCommand for a group', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          'group-1': {
            projects: ['lib-a'],
            version: {
              groupPreVersionCommand: 'nx run-many -t build -p lib-a',
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "nx run-many -t build -p lib-a",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow configuration of releaseTagPatternRequireSemver via the top level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        releaseTagPatternRequireSemver: false,
        groups: {
          'group-1': {
            projects: ['lib-a'],
          },
          'group-2': {
            projects: ['lib-b'],
            releaseTagPatternRequireSemver: true,
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
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-2": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-b",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "releaseTagPatternRequireSemver": true,
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": false,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow configuration of releaseTagPatternStrictPreid via the top level and group level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        releaseTagPatternStrictPreid: true,
        groups: {
          'group-1': {
            projects: ['lib-a'],
          },
          'group-2': {
            projects: ['lib-b'],
            releaseTagPatternStrictPreid: false,
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
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-2": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-b",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": false,
                },
                "releaseTagPatternStrictPreid": false,
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow setting top level docker options', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        docker: {
          preVersionCommand: 'npx nx run-many docker:build -p lib-a',
          versionSchemes: {
            production: '{currentDate|YY.MM.DD}.prod',
            staging: '{currentDate|YY.MM.DD}.staging',
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": {
              "preVersionCommand": "npx nx run-many docker:build -p lib-a",
              "registryUrl": undefined,
              "repositoryName": undefined,
              "skipVersionActions": undefined,
              "versionSchemes": {
                "production": "{currentDate|YY.MM.DD}.prod",
                "staging": "{currentDate|YY.MM.DD}.staging",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": {
                  "groupPreVersionCommand": "",
                  "registryUrl": undefined,
                  "repositoryName": undefined,
                  "skipVersionActions": undefined,
                  "versionSchemes": {
                    "production": "{currentDate|YY.MM.DD}.prod",
                    "staging": "{currentDate|YY.MM.DD}.staging",
                  },
                },
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": true,
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });
    it('should allow setting top level docker as true to infer defaults', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        docker: true,
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": {
              "preVersionCommand": "npx nx run-many -t docker:build",
              "registryUrl": undefined,
              "repositoryName": undefined,
              "skipVersionActions": undefined,
              "versionSchemes": {
                "hotfix": "{currentDate|YYMM.DD}.{shortCommitSha}-hotfix",
                "production": "{currentDate|YYMM.DD}.{shortCommitSha}",
              },
            },
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": {
                  "groupPreVersionCommand": "",
                  "registryUrl": undefined,
                  "repositoryName": undefined,
                  "skipVersionActions": undefined,
                  "versionSchemes": {
                    "hotfix": "{currentDate|YYMM.DD}.{shortCommitSha}-hotfix",
                    "production": "{currentDate|YYMM.DD}.{shortCommitSha}",
                  },
                },
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": true,
                  "requireSemver": false,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow setting preserveMatchingDependencyRanges to true at top level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        version: {
          preserveMatchingDependencyRanges: true,
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow setting preserveMatchingDependencyRanges to an array of strings at top level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        version: {
          preserveMatchingDependencyRanges: [
            'dependencies',
            'peerDependencies',
          ],
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": [
                    "dependencies",
                    "peerDependencies",
                  ],
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": [
                "dependencies",
                "peerDependencies",
              ],
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{projectName}__{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "{projectName}__{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
              preVersionCommand: 'npx nx run nx:build',
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
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
                    "applyUsernameToAuthors": true,
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preVersionCommand": "npx nx run nx:build",
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": false,
                  "commitReferences": false,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "Custom no changes!",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
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
                    "applyUsernameToAuthors": true,
                    "authors": false,
                    "commitReferences": false,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
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
                    "applyUsernameToAuthors": true,
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow configuring gitlab as a shorthand for createRelease for the workspace changelog', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          workspaceChangelog: {
            createRelease: 'gitlab',
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
                "push": true,
                "pushArgs": "",
                "stageChanges": false,
                "tag": true,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": {
                  "apiBaseUrl": "https://gitlab.com/api/v4",
                  "hostname": "gitlab.com",
                  "provider": "gitlab",
                },
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow configuring a gitlab hostname and set a default apiBaseUrl for the workspace changelog', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          workspaceChangelog: {
            createRelease: {
              provider: 'gitlab',
              hostname: 'gitlab.example.com',
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
                "push": true,
                "pushArgs": "",
                "stageChanges": false,
                "tag": true,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": {
                  "apiBaseUrl": "https://gitlab.example.com/api/v4",
                  "hostname": "gitlab.example.com",
                  "provider": "gitlab",
                },
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow configuring a github-enterprise-server hostname and set a default apiBaseUrl for the workspace changelog', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          workspaceChangelog: {
            createRelease: {
              provider: 'github-enterprise-server',
              hostname: 'github.example.com',
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
                "push": true,
                "pushArgs": "",
                "stageChanges": false,
                "tag": true,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": {
                  "apiBaseUrl": "https://github.example.com/api/v3",
                  "hostname": "github.example.com",
                  "provider": "github-enterprise-server",
                },
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow configuring a github-enterprise-server hostname AND a custom apiBaseUrl for the workspace changelog', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          workspaceChangelog: {
            createRelease: {
              provider: 'github-enterprise-server',
              hostname: 'github.example.com',
              apiBaseUrl: 'http://something-custom.com',
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
                "push": true,
                "pushArgs": "",
                "stageChanges": false,
                "tag": true,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": false,
              "workspaceChangelog": {
                "createRelease": {
                  "apiBaseUrl": "http://something-custom.com",
                  "hostname": "github.example.com",
                  "provider": "github-enterprise-server",
                },
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should return an error if an invalid provider, hostname or apiBaseUrl is specified for createRelease for the workspace changelog', async () => {
      const res1 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          workspaceChangelog: {
            createRelease: {
              provider: 'something-invalid',
            } as any,
          },
        },
      });
      expect(res1.error).toMatchInlineSnapshot(`
        {
          "code": "INVALID_CHANGELOG_CREATE_RELEASE_PROVIDER",
          "data": {
            "provider": "something-invalid",
            "supportedProviders": [
              "github-enterprise-server",
              "gitlab",
            ],
          },
        }
      `);

      const res2 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          workspaceChangelog: {
            createRelease: {
              provider: 'github-enterprise-server',
              hostname: 'not_a_hostname',
            },
          },
        },
      });
      expect(res2.error).toMatchInlineSnapshot(`
        {
          "code": "INVALID_CHANGELOG_CREATE_RELEASE_HOSTNAME",
          "data": {
            "hostname": "not_a_hostname",
          },
        }
      `);

      const res3 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          workspaceChangelog: {
            createRelease: {
              provider: 'github-enterprise-server',
              hostname: 'example.com',
              apiBaseUrl: 'not_a_url',
            },
          },
        },
      });
      expect(res3.error).toMatchInlineSnapshot(`
        {
          "code": "INVALID_CHANGELOG_CREATE_RELEASE_API_BASE_URL",
          "data": {
            "apiBaseUrl": "not_a_url",
          },
        }
      `);
    });

    it('should allow configuring a github-enterprise-server hostname and set a default apiBaseUrl for project changelogs', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          workspaceChangelog: false,
          projectChangelogs: {
            createRelease: {
              provider: 'github-enterprise-server',
              hostname: 'github.example.com',
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
                "push": true,
                "pushArgs": "",
                "stageChanges": false,
                "tag": true,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": {
                "createRelease": {
                  "apiBaseUrl": "https://github.example.com/api/v3",
                  "hostname": "github.example.com",
                  "provider": "github-enterprise-server",
                },
                "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                "file": "{projectRoot}/CHANGELOG.md",
                "renderOptions": {
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
              "workspaceChangelog": false,
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": {
                  "createRelease": {
                    "apiBaseUrl": "https://github.example.com/api/v3",
                    "hostname": "github.example.com",
                    "provider": "github-enterprise-server",
                  },
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "applyUsernameToAuthors": true,
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow configuring a github-enterprise-server hostname AND a custom apiBaseUrl for project changelogs', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          workspaceChangelog: false,
          projectChangelogs: {
            createRelease: {
              provider: 'github-enterprise-server',
              hostname: 'github.example.com',
              apiBaseUrl: 'http://something-custom.com',
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
                "push": true,
                "pushArgs": "",
                "stageChanges": false,
                "tag": true,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": {
                "createRelease": {
                  "apiBaseUrl": "http://something-custom.com",
                  "hostname": "github.example.com",
                  "provider": "github-enterprise-server",
                },
                "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                "file": "{projectRoot}/CHANGELOG.md",
                "renderOptions": {
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
              "workspaceChangelog": false,
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": {
                  "createRelease": {
                    "apiBaseUrl": "http://something-custom.com",
                    "hostname": "github.example.com",
                    "provider": "github-enterprise-server",
                  },
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "applyUsernameToAuthors": true,
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should return an error if an invalid provider, hostname or apiBaseUrl is specified for createRelease for project changelogs', async () => {
      const res1 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          projectChangelogs: {
            createRelease: {
              provider: 'something-invalid',
            } as any,
          },
        },
      });
      expect(res1.error).toMatchInlineSnapshot(`
        {
          "code": "INVALID_CHANGELOG_CREATE_RELEASE_PROVIDER",
          "data": {
            "provider": "something-invalid",
            "supportedProviders": [
              "github-enterprise-server",
              "gitlab",
            ],
          },
        }
      `);

      const res2 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          projectChangelogs: {
            createRelease: {
              provider: 'github-enterprise-server',
              hostname: 'not_a_hostname',
            },
          },
        },
      });
      expect(res2.error).toMatchInlineSnapshot(`
        {
          "code": "INVALID_CHANGELOG_CREATE_RELEASE_HOSTNAME",
          "data": {
            "hostname": "not_a_hostname",
          },
        }
      `);

      const res3 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          projectChangelogs: {
            createRelease: {
              provider: 'github-enterprise-server',
              hostname: 'example.com',
              apiBaseUrl: 'not_a_url',
            },
          },
        },
      });
      expect(res3.error).toMatchInlineSnapshot(`
        {
          "code": "INVALID_CHANGELOG_CREATE_RELEASE_API_BASE_URL",
          "data": {
            "apiBaseUrl": "not_a_url",
          },
        }
      `);
    });

    it('should return an error if createRelease is enabled but git push is explicitly disabled', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          workspaceChangelog: {
            createRelease: 'github',
          },
        },
        git: {
          push: false,
        },
      });
      expect(res.error).toMatchInlineSnapshot(`
        {
          "code": "GIT_PUSH_FALSE_WITH_CREATE_RELEASE",
          "data": {},
        }
      `);

      const res2 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          git: {
            push: false,
          },
          workspaceChangelog: {
            createRelease: 'github',
          },
        },
      });
      expect(res2.error).toMatchInlineSnapshot(`
        {
          "code": "GIT_PUSH_FALSE_WITH_CREATE_RELEASE",
          "data": {},
        }
      `);

      const res3 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          projectChangelogs: {
            createRelease: 'github',
          },
        },
        git: {
          push: false,
        },
      });
      expect(res3.error).toMatchInlineSnapshot(`
        {
          "code": "GIT_PUSH_FALSE_WITH_CREATE_RELEASE",
          "data": {},
        }
      `);

      const res4 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          git: {
            push: false,
          },
          projectChangelogs: {
            createRelease: 'github',
          },
        },
      });
      expect(res4.error).toMatchInlineSnapshot(`
        {
          "code": "GIT_PUSH_FALSE_WITH_CREATE_RELEASE",
          "data": {},
        }
      `);

      const res5 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          workspaceChangelog: {
            createRelease: 'github',
          },
        },
        version: {
          git: {
            push: false,
          },
        },
      });
      expect(res5.error).toMatchInlineSnapshot(`
        {
          "code": "GIT_PUSH_FALSE_WITH_CREATE_RELEASE",
          "data": {},
        }
      `);

      const res6 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        changelog: {
          projectChangelogs: {
            createRelease: 'github',
          },
        },
        version: {
          git: {
            push: false,
          },
        },
      });
      expect(res6.error).toMatchInlineSnapshot(`
        {
          "code": "GIT_PUSH_FALSE_WITH_CREATE_RELEASE",
          "data": {},
        }
      `);

      const res7 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          'group-1': {
            projects: ['lib-a'],
            changelog: {
              createRelease: 'github',
            },
          },
        },
        git: {
          push: false,
        },
      });
      expect(res7.error).toMatchInlineSnapshot(`
        {
          "code": "GIT_PUSH_FALSE_WITH_CREATE_RELEASE",
          "data": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                applyUsernameToAuthors: false, // override deeply nested field in group config
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
                "push": true,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
              "workspaceChangelog": false,
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": {
                  "createRelease": {
                    "apiBaseUrl": "https://api.github.com",
                    "hostname": "github.com",
                    "provider": "github",
                  },
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "./{projectRoot}/custom-path.md",
                  "renderOptions": {
                    "applyUsernameToAuthors": false,
                    "authors": false,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-2": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-b",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-3": {
                "changelog": {
                  "createRelease": false,
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "./{projectRoot}/a-different-custom-path-at-the-group.md",
                  "renderOptions": {
                    "applyUsernameToAuthors": true,
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": true,
                "pushArgs": "",
                "stageChanges": false,
                "tag": true,
                "tagArgs": "",
                "tagMessage": "",
              },
              "projectChangelogs": {
                "createRelease": {
                  "apiBaseUrl": "https://api.github.com",
                  "hostname": "github.com",
                  "provider": "github",
                },
                "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                "file": "{projectRoot}/CHANGELOG.md",
                "renderOptions": {
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
              "workspaceChangelog": {
                "createRelease": {
                  "apiBaseUrl": "https://api.github.com",
                  "hostname": "github.com",
                  "provider": "github",
                },
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "foo": {
                "changelog": {
                  "createRelease": {
                    "apiBaseUrl": "https://api.github.com",
                    "hostname": "github.com",
                    "provider": "github",
                  },
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "applyUsernameToAuthors": true,
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{projectName}-{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "releaseTagPattern": "{projectName}-{version}",
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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

    it('should allow configuring a github-enterprise-server hostname and set a default apiBaseUrl for project changelogs', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          foo: {
            projects: 'lib-a',
            changelog: {
              createRelease: {
                provider: 'github-enterprise-server',
                hostname: 'custom-github-enterprise-server.com',
              },
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
                "push": true,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "foo": {
                "changelog": {
                  "createRelease": {
                    "apiBaseUrl": "https://custom-github-enterprise-server.com/api/v3",
                    "hostname": "custom-github-enterprise-server.com",
                    "provider": "github-enterprise-server",
                  },
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "applyUsernameToAuthors": true,
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should allow configuring a github-enterprise-server hostname AND a custom apiBaseUrl for project changelogs', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          foo: {
            projects: 'lib-a',
            changelog: {
              createRelease: {
                provider: 'github-enterprise-server',
                hostname: 'custom-github-enterprise-server.com',
                apiBaseUrl:
                  'https://custom-github-enterprise-server.com/api/v99',
              },
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
                "push": true,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "foo": {
                "changelog": {
                  "createRelease": {
                    "apiBaseUrl": "https://custom-github-enterprise-server.com/api/v99",
                    "hostname": "custom-github-enterprise-server.com",
                    "provider": "github-enterprise-server",
                  },
                  "entryWhenNoChanges": "This was a version bump only for {projectName} to align it with other projects, there were no code changes.",
                  "file": "{projectRoot}/CHANGELOG.md",
                  "renderOptions": {
                    "applyUsernameToAuthors": true,
                    "authors": true,
                    "commitReferences": true,
                    "versionTitleDate": true,
                  },
                  "renderer": "<dirname>/release/changelog-renderer",
                },
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should return an error if an invalid provider, hostname or apiBaseUrl is specified for createRelease for project changelogs', async () => {
      const res1 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          foo: {
            projects: 'lib-a',
            changelog: {
              createRelease: {
                provider: 'something-invalid',
              } as any,
            },
          },
        },
      });
      expect(res1.error).toMatchInlineSnapshot(`
        {
          "code": "INVALID_CHANGELOG_CREATE_RELEASE_PROVIDER",
          "data": {
            "provider": "something-invalid",
            "supportedProviders": [
              "github-enterprise-server",
              "gitlab",
            ],
          },
        }
      `);

      const res2 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          foo: {
            projects: 'lib-a',
            changelog: {
              createRelease: {
                provider: 'github-enterprise-server',
                hostname: 'not_a_hostname',
              },
            },
          },
        },
      });
      expect(res2.error).toMatchInlineSnapshot(`
        {
          "code": "INVALID_CHANGELOG_CREATE_RELEASE_HOSTNAME",
          "data": {
            "hostname": "not_a_hostname",
          },
        }
      `);

      const res3 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          foo: {
            projects: 'lib-a',
            changelog: {
              createRelease: {
                provider: 'github-enterprise-server',
                hostname: 'example.com',
                apiBaseUrl: 'not_a_url',
              },
            },
          },
        },
      });
      expect(res3.error).toMatchInlineSnapshot(`
        {
          "code": "INVALID_CHANGELOG_CREATE_RELEASE_API_BASE_URL",
          "data": {
            "apiBaseUrl": "not_a_url",
          },
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

  describe('default releaseTagPatterns', () => {
    it('should have a default pattern of v{version}', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {});
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should use releaseTagPattern from base config for independent release groups as long as {projectName} is used', async () => {
      let res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        releaseTagPattern: 'release/{projectName}/{version}',
        groups: {
          'group-1': {
            projects: 'lib-a',
            projectsRelationship: 'independent',
          },
        },
      });

      expect(res.nxReleaseConfig.groups['group-1'].releaseTag.pattern).toEqual(
        'release/{projectName}/{version}'
      );

      // The specified pattern may conflict between independent projects, so use the default independent tag pattern.
      res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        releaseTag: {
          pattern: 'v{version}',
        },
        groups: {
          'group-1': {
            projects: 'lib-a',
            projectsRelationship: 'independent',
          },
        },
      });

      expect(res.nxReleaseConfig.groups['group-1'].releaseTag.pattern).toEqual(
        '{projectName}@{version}'
      );
    });

    /**
     * TODO: make this the default behavior in v20 (it's a breaking change)
     */
    it.skip('should have a default pattern of {releaseGroupName}-v{version} when one or more custom release groups are used', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          'group-1': {
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
              "workspaceChangelog": {
                "createRelease": false,
                "entryWhenNoChanges": "This was a version bump only, there were no code changes.",
                "file": "{workspaceRoot}/CHANGELOG.md",
                "renderOptions": {
                  "authors": true,
                  "commitReferences": true,
                  "applyUsernameToAuthors": true,
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
                "releaseTagPattern": "{releaseGroupName}-v{version}",
                "version": {
                  "conventionalCommits": false,
                  "generator": "@nx/js:release-version",
                  "generatorOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTagPattern": "{releaseGroupName}-v{version}",
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
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "independent",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-2": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "independent",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "{projectName}@{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                ],
                "projectsRelationship": "independent",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{projectName}@{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "independent",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "{projectName}@{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
          currentVersionResolver: 'git-tag',
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "currentVersionResolver": "git-tag",
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": "git-tag",
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);

      const res2 = await createNxReleaseConfig(projectGraph, projectFileMap, {
        version: {
          currentVersionResolver: 'registry',
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "currentVersionResolver": "registry",
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": "registry",
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": true,
                  "currentVersionResolver": "git-tag",
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "specifierSource": "conventional-commits",
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": true,
              "currentVersionResolver": "git-tag",
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": "conventional-commits",
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
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
          fallbackCurrentVersionResolver: 'disk',
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
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "fallbackCurrentVersionResolver": "disk",
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": true,
              "currentVersionResolver": "git-tag",
              "fallbackCurrentVersionResolver": "disk",
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": "conventional-commits",
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });
  });

  describe('versionPlans', () => {
    it('should respect user "versionPlans" set at root level', async () => {
      const resBoolean = await createNxReleaseConfig(
        projectGraph,
        projectFileMap,
        {
          versionPlans: true,
        }
      );

      expect(resBoolean).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "specifierSource": "version-plans",
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": true,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": "version-plans",
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": true,
          },
        }
      `);

      const resObject = await createNxReleaseConfig(
        projectGraph,
        projectFileMap,
        {
          versionPlans: {
            ignorePatternsForPlanCheck: ['**/*.spec.ts'],
          },
        }
      );

      expect(resObject).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
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
                  "applyUsernameToAuthors": true,
                  "authors": true,
                  "commitReferences": true,
                  "versionTitleDate": true,
                },
                "renderer": "<dirname>/release/changelog-renderer",
              },
            },
            "conventionalCommits": {
              "types": {
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "__default__": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                  "lib-b",
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "specifierSource": "version-plans",
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": {
                  "ignorePatternsForPlanCheck": [
                    "**/*.spec.ts",
                  ],
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": "version-plans",
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": {
              "ignorePatternsForPlanCheck": [
                "**/*.spec.ts",
              ],
            },
          },
        }
      `);
    });

    it('should respect user "versionPlans" set at group level', async () => {
      const resBoolean = await createNxReleaseConfig(
        projectGraph,
        projectFileMap,
        {
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
        }
      );

      expect(resBoolean).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "specifierSource": "version-plans",
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": true,
              },
              "group-2": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);

      const resObject = await createNxReleaseConfig(
        projectGraph,
        projectFileMap,
        {
          groups: {
            'group-1': {
              projects: 'nx',
              versionPlans: {
                ignorePatternsForPlanCheck: ['**/eslint.config.cjs'],
              },
            },
            'group-2': {
              projects: 'lib-a',
              versionPlans: false,
            },
          },
        }
      );

      expect(resObject).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "specifierSource": "version-plans",
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": {
                  "ignorePatternsForPlanCheck": [
                    "**/eslint.config.cjs",
                  ],
                },
              },
              "group-2": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": undefined,
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": false,
          },
        }
      `);
    });

    it('should override "versionPlans" with false when set at the group level', async () => {
      const resBoolean = await createNxReleaseConfig(
        projectGraph,
        projectFileMap,
        {
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
        }
      );

      expect(resBoolean).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-2": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "specifierSource": "version-plans",
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": true,
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": "version-plans",
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": true,
          },
        }
      `);

      const resObject = await createNxReleaseConfig(
        projectGraph,
        projectFileMap,
        {
          versionPlans: {
            ignorePatternsForPlanCheck: [
              '**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
            ],
          },
          groups: {
            'group-1': {
              projects: 'nx',
              versionPlans: false,
            },
            'group-2': {
              projects: 'lib-a',
            },
          },
        }
      );

      expect(resObject).toMatchInlineSnapshot(`
        {
          "error": null,
          "nxReleaseConfig": {
            "changelog": {
              "automaticFromRef": false,
              "git": {
                "commit": true,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
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
                "__INVALID__": {
                  "changelog": {
                    "hidden": true,
                    "title": "Invalid based on conventional commits specification",
                  },
                  "semverBump": "none",
                },
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
            "docker": undefined,
            "git": {
              "commit": false,
              "commitArgs": "",
              "commitMessage": "chore(release): publish {version}",
              "push": false,
              "pushArgs": "",
              "stageChanges": false,
              "tag": false,
              "tagArgs": "",
              "tagMessage": "",
            },
            "groups": {
              "group-1": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "nx",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": false,
              },
              "group-2": {
                "changelog": false,
                "docker": undefined,
                "projects": [
                  "lib-a",
                ],
                "projectsRelationship": "fixed",
                "releaseTag": {
                  "checkAllBranchesWhen": undefined,
                  "pattern": "{releaseGroupName}-v{version}",
                  "preferDockerVersion": false,
                  "requireSemver": true,
                  "strictPreid": true,
                },
                "version": {
                  "conventionalCommits": false,
                  "groupPreVersionCommand": "",
                  "logUnchangedProjects": true,
                  "preserveLocalDependencyProtocols": true,
                  "preserveMatchingDependencyRanges": true,
                  "specifierSource": "version-plans",
                  "updateDependents": "always",
                  "versionActions": "@nx/js/src/release/version-actions",
                  "versionActionsOptions": {},
                },
                "versionPlans": {
                  "ignorePatternsForPlanCheck": [
                    "**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
                  ],
                },
              },
            },
            "projectsRelationship": "fixed",
            "releaseTag": {
              "checkAllBranchesWhen": undefined,
              "pattern": "v{version}",
              "preferDockerVersion": false,
              "requireSemver": true,
              "strictPreid": true,
            },
            "version": {
              "conventionalCommits": false,
              "currentVersionResolver": undefined,
              "git": {
                "commit": false,
                "commitArgs": "",
                "commitMessage": "chore(release): publish {version}",
                "push": false,
                "pushArgs": "",
                "stageChanges": true,
                "tag": false,
                "tagArgs": "",
                "tagMessage": "",
              },
              "logUnchangedProjects": true,
              "preVersionCommand": "",
              "preserveLocalDependencyProtocols": true,
              "preserveMatchingDependencyRanges": true,
              "specifierSource": "version-plans",
              "updateDependents": "always",
              "versionActions": "@nx/js/src/release/version-actions",
              "versionActionsOptions": {},
            },
            "versionPlans": {
              "ignorePatternsForPlanCheck": [
                "**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
              ],
            },
          },
        }
      `);
    });
  });

  describe('updateDependents configuration', () => {
    it('should default to "always" when not specified', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {});

      expect(
        res.nxReleaseConfig.groups.__default__.version.updateDependents
      ).toBe('always');
      expect(res.nxReleaseConfig.version.updateDependents).toBe('always');
    });

    it('should allow overriding updateDependents at the group level', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        version: {
          updateDependents: 'always',
        },
        groups: {
          'group-1': {
            projects: 'nx',
            version: {
              updateDependents: 'auto',
            },
          },
          'group-2': {
            projects: 'lib-a',
            version: {
              updateDependents: 'never',
            },
          },
        },
      });

      expect(
        res.nxReleaseConfig.groups['group-1'].version.updateDependents
      ).toBe('auto');
      expect(
        res.nxReleaseConfig.groups['group-2'].version.updateDependents
      ).toBe('never');
      expect(res.nxReleaseConfig.version.updateDependents).toBe('always');
    });
  });
  describe('docker version schemes validation', () => {
    it('should error when skipVersionActions is configured and version scheme uses {versionActionsVersion}', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          'group-1': {
            projects: 'lib-a',
            docker: {
              skipVersionActions: true,
              versionSchemes: {
                production: '{versionActionsVersion}',
              },
            },
          },
        },
      });
      expect(res).toMatchInlineSnapshot(`
        {
          "error": {
            "code": "DOCKER_VERSION_SCHEME_USES_VERSION_ACTIONS_VERSION_WHEN_SKIP_VERSION_ACTIONS",
            "data": {
              "releaseGroupName": "group-1",
              "schemeName": "production",
            },
          },
          "nxReleaseConfig": null,
        }
      `);
    });

    it('should allow docker version schemes without the {versionActionsVersion} placeholder when skipVersionActions is configured', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          'group-1': {
            projects: 'lib-a',
            docker: {
              skipVersionActions: true,
              versionSchemes: {
                production: '{currentDate|YYMM.DD}.{shortCommitSha}',
              },
            },
          },
        },
      });
      expect(res.error).toBeNull();
    });

    it('should allow docker version schemes with the {versionActionsVersion} placeholder when skipVersionActions is not configured', async () => {
      const res = await createNxReleaseConfig(projectGraph, projectFileMap, {
        groups: {
          'group-1': {
            projects: 'lib-a',
            docker: {
              versionSchemes: {
                production: '{versionActionsVersion}-rc.{shortCommitSha}',
              },
            },
          },
        },
      });
      expect(res.error).toBeNull();
    });
  });
});
