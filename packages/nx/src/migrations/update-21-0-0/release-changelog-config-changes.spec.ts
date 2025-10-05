import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';

import update from './release-changelog-config-changes';

describe('release changelog config changes', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should do nothing when nxJson.release is not set', async () => {
    updateNxJson(tree, {});
    await update(tree);
    expect(readNxJson(tree)).toEqual({});
  });

  it('should do nothing when mapAuthorsToGitHubUsernames is not set', async () => {
    const nxJsonBefore = {
      release: {
        changelog: {
          workspaceChangelog: {
            renderOptions: {},
          },
        },
      },
    };
    updateNxJson(tree, nxJsonBefore);

    await update(tree);

    expect(readNxJson(tree)).toEqual(nxJsonBefore);
  });

  it('should update mapAuthorsToGitHubUsernames to applyUsernameToAuthors if set at any level', async () => {
    updateNxJson(tree, {
      release: {
        changelog: {
          workspaceChangelog: {
            renderOptions: { mapAuthorsToGitHubUsernames: true },
          },
          projectChangelogs: {
            renderOptions: { mapAuthorsToGitHubUsernames: false },
          },
        },
        groups: {
          group1: {
            projects: ['project1', 'project2'],
            changelog: {
              renderOptions: { mapAuthorsToGitHubUsernames: true },
            },
          },
        },
      },
    });

    await update(tree);

    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "release": {
          "changelog": {
            "projectChangelogs": {
              "renderOptions": {
                "applyUsernameToAuthors": false,
              },
            },
            "workspaceChangelog": {
              "renderOptions": {
                "applyUsernameToAuthors": true,
              },
            },
          },
          "groups": {
            "group1": {
              "changelog": {
                "renderOptions": {
                  "applyUsernameToAuthors": true,
                },
              },
              "projects": [
                "project1",
                "project2",
              ],
            },
          },
        },
      }
    `);
  });
});
