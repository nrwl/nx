import { NxJsonConfiguration } from '../../config/nx-json';
import { createTree } from '../../generators/testing-utils/create-tree';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { readJson, writeJson } from '../../generators/utils/json';
import nxReleaseGitOperationsExplicitOptOut from './nx-release-git-operations-explicit-opt-out';

describe('nxReleaseGitOperationsExplicitOptOut', () => {
  let tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not error if nx.json is not present', () => {
    nxReleaseGitOperationsExplicitOptOut(createTree());
  });

  it('should do nothing if release is not configured', () => {
    writeJson(tree, 'nx.json', {});

    nxReleaseGitOperationsExplicitOptOut(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.release).toBeUndefined();
  });

  it('should set commit and tag to false if changelog.git.commit is not defined', () => {
    writeJson(tree, 'nx.json', {
      release: {
        version: {
          git: {
            // override properties in version.git should be ignored
            commit: true,
            tag: true,
          },
        },
      },
    });

    nxReleaseGitOperationsExplicitOptOut(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.release).toEqual({
      git: {
        commit: false,
        tag: false,
      },
      version: {
        git: {
          commit: true,
          tag: true,
        },
      },
    });
  });

  it('should not set commit and tag to false if changelog.git.commit is not defined but global git config is defined', () => {
    writeJson(tree, 'nx.json', {
      release: {
        git: {
          commit: false,
          tag: true,
        },
        version: {
          git: {
            // override properties in version.git should be ignored
            commit: true,
            tag: true,
          },
        },
      },
    });

    nxReleaseGitOperationsExplicitOptOut(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.release).toEqual({
      git: {
        commit: false,
        tag: true,
      },
      version: {
        git: {
          commit: true,
          tag: true,
        },
      },
    });
  });

  describe('consolidation', () => {
    it('should consolidate version.git and changelog.git if they both exist and have matching true values', () => {
      writeJson<NxJsonConfiguration>(tree, 'nx.json', {
        release: {
          git: {
            commit: false,
            tag: false,
          },
          version: {
            git: {
              commit: true,
              tag: true,
            },
          },
          changelog: {
            git: {
              commit: true,
              tag: true,
            },
          },
        },
      });

      nxReleaseGitOperationsExplicitOptOut(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        git: {
          commit: true,
          tag: true,
        },
      });
    });

    it('should consolidate version.git and changelog.git if they both exist and have matching false values', () => {
      writeJson<NxJsonConfiguration>(tree, 'nx.json', {
        release: {
          git: {
            commit: true,
            tag: true,
          },
          version: {
            git: {
              commit: false,
              tag: false,
            },
          },
          changelog: {
            git: {
              commit: false,
              tag: false,
            },
          },
        },
      });

      nxReleaseGitOperationsExplicitOptOut(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        git: {
          commit: false,
          tag: false,
        },
      });
    });

    it('should consolidate commit property but not change other properties', () => {
      writeJson<NxJsonConfiguration>(tree, 'nx.json', {
        release: {
          version: {
            git: {
              commit: true,
              tag: false,
              commitMessage: 'Version commit message',
            },
          },
          changelog: {
            git: {
              commit: true,
              tag: true,
              tagMessage: 'Version tag message',
            },
          },
        },
      });

      nxReleaseGitOperationsExplicitOptOut(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        git: {
          commit: true,
        },
        version: {
          git: {
            tag: false,
            commitMessage: 'Version commit message',
          },
        },
        changelog: {
          git: {
            tag: true,
            tagMessage: 'Version tag message',
          },
        },
      });
    });

    it('should consolidate tag property but not change other properties', () => {
      writeJson<NxJsonConfiguration>(tree, 'nx.json', {
        release: {
          version: {
            git: {
              commit: false,
              tag: true,
              commitMessage: 'Version commit message',
            },
          },
          changelog: {
            git: {
              commit: true,
              tag: true,
              tagMessage: 'Version tag message',
            },
          },
        },
      });

      nxReleaseGitOperationsExplicitOptOut(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        git: {
          tag: true,
        },
        version: {
          git: {
            commit: false,
            commitMessage: 'Version commit message',
          },
        },
        changelog: {
          git: {
            commit: true,
            tagMessage: 'Version tag message',
          },
        },
      });
    });

    it('should remove empty version and changelog properties', () => {
      writeJson<NxJsonConfiguration>(tree, 'nx.json', {
        release: {
          git: {
            commit: true,
            tag: true,
          },
          version: {
            git: {},
          },
          changelog: {
            git: {},
          },
        },
      });

      nxReleaseGitOperationsExplicitOptOut(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        git: {
          commit: true,
          tag: true,
        },
      });
    });

    it('should remove empty global git property', () => {
      writeJson<NxJsonConfiguration>(tree, 'nx.json', {
        release: {
          git: {},
          version: {
            git: {
              commit: false,
              tag: false,
            },
          },
          changelog: {
            git: {
              commit: true,
              tag: true,
            },
          },
        },
      });

      nxReleaseGitOperationsExplicitOptOut(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        version: {
          git: {
            commit: false,
            tag: false,
          },
        },
        changelog: {
          git: {
            commit: true,
            tag: true,
          },
        },
      });
    });
  });
});
