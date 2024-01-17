import { NxJsonConfiguration } from '../../config/nx-json';
import { createTree } from '../../generators/testing-utils/create-tree';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import { readJson, writeJson } from '../../generators/utils/json';
import nxReleaseGitOperationsExplicitOptOut from './nx-release-git-operations-explicit-opt-out';

describe('nxReleaseGitOperationsExplicitOptOut', () => {
  let tree: Tree;

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

  describe('stageChanges', () => {
    it('should set version.stageChanges to false if committing is not explicitly enabled and granular version.git config exists', () => {
      writeJson(tree, 'nx.json', {
        release: {
          version: {
            git: {},
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
            stageChanges: false,
          },
        },
      });
    });

    it('should set version.stageChanges to false if committing is not explicitly enabled and granular changelog.git config exists', () => {
      writeJson(tree, 'nx.json', {
        release: {
          changelog: {
            git: {},
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
        changelog: {
          git: {},
        },
        version: {
          git: {
            stageChanges: false,
          },
        },
      });
    });

    it('should not set version.stageChanges if granular config is not found', () => {
      writeJson(tree, 'nx.json', {
        release: {
          git: {
            commit: false,
            tag: false,
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

    it('should not set version.stageChanges if committing is enabled globally', () => {
      writeJson(tree, 'nx.json', {
        release: {
          git: {
            commit: true,
            tag: false,
          },
        },
      });

      nxReleaseGitOperationsExplicitOptOut(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.release).toEqual({
        git: {
          commit: true,
          tag: false,
        },
      });
    });

    it('should not set version.stageChanges if committing is enabled in version', () => {
      writeJson(tree, 'nx.json', {
        release: {
          git: {
            commit: false,
            tag: false,
          },
          version: {
            git: {
              commit: true,
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
          },
        },
      });
    });

    it('should not set version.stageChanges if committing is enabled in changelog', () => {
      writeJson(tree, 'nx.json', {
        release: {
          git: {
            commit: false,
            tag: false,
          },
          changelog: {
            git: {
              commit: true,
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
        changelog: {
          git: {
            commit: true,
          },
        },
      });
    });
  });
});
