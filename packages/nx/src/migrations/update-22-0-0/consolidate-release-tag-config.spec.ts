import { readJson, updateJson } from '../../generators/utils/json';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import migrate from './consolidate-release-tag-config';
import type { Tree } from '../../generators/tree';

describe('consolidate-release-tag-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should migrate top-level release configuration', async () => {
    updateJson(tree, 'nx.json', (json) => {
      json.release = {
        releaseTagPattern: 'v{version}',
        releaseTagPatternCheckAllBranchesWhen: true,
        releaseTagPatternRequireSemver: true,
        releaseTagPatternPreferDockerVersion: false,
        releaseTagPatternStrictPreid: false,
      };
      return json;
    });

    await migrate(tree);

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.release).toEqual({
      releaseTag: {
        pattern: 'v{version}',
        checkAllBranchesWhen: true,
        requireSemver: true,
        preferDockerVersion: false,
        strictPreid: false,
      },
    });
  });

  it('should migrate release groups configuration', async () => {
    updateJson(tree, 'nx.json', (json) => {
      json.release = {
        groups: {
          'my-group': {
            projects: ['my-project'],
            releaseTagPattern: '{projectName}@{version}',
            releaseTagPatternCheckAllBranchesWhen: ['main', 'develop'],
            releaseTagPatternRequireSemver: false,
            releaseTagPatternPreferDockerVersion: 'both',
            releaseTagPatternStrictPreid: true,
          },
        },
      };
      return json;
    });

    await migrate(tree);

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.release.groups['my-group']).toEqual({
      projects: ['my-project'],
      releaseTag: {
        pattern: '{projectName}@{version}',
        checkAllBranchesWhen: ['main', 'develop'],
        requireSemver: false,
        preferDockerVersion: 'both',
        strictPreid: true,
      },
    });
  });

  it('should migrate project-level configuration in project.json', async () => {
    tree.write('project.json', '{}');
    updateJson(tree, 'nx.json', (json) => {
      json.projects = {
        'my-project': {
          root: '.',
        },
      };
      return json;
    });

    updateJson(tree, 'project.json', (json) => {
      json.release = {
        releaseTagPattern: 'v{version}',
        releaseTagPatternCheckAllBranchesWhen: false,
      };
      return json;
    });

    await migrate(tree);

    const projectJson = readJson(tree, 'project.json');
    expect(projectJson.release).toEqual({
      releaseTag: {
        pattern: 'v{version}',
        checkAllBranchesWhen: false,
      },
    });
  });

  it('should migrate project-level configuration in package.json', async () => {
    tree.write('package.json', '{}');
    updateJson(tree, 'nx.json', (json) => {
      json.projects = {
        'my-project': {
          root: '.',
        },
      };
      return json;
    });

    updateJson(tree, 'package.json', (json) => {
      json.nx = {
        release: {
          releaseTagPattern: '{projectName}@{version}',
          releaseTagPatternRequireSemver: true,
        },
      };
      return json;
    });

    await migrate(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.nx.release).toEqual({
      releaseTag: {
        pattern: '{projectName}@{version}',
        requireSemver: true,
      },
    });
  });

  it('should not override new format with old format', async () => {
    updateJson(tree, 'nx.json', (json) => {
      json.release = {
        releaseTagPattern: 'old-{version}',
        releaseTag: {
          pattern: 'new-{version}',
          checkAllBranchesWhen: true,
        },
      };
      return json;
    });

    await migrate(tree);

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.release).toEqual({
      releaseTag: {
        pattern: 'new-{version}',
        checkAllBranchesWhen: true,
      },
    });
  });

  it('should handle partial migrations', async () => {
    updateJson(tree, 'nx.json', (json) => {
      json.release = {
        releaseTagPattern: 'v{version}',
        releaseTag: {
          checkAllBranchesWhen: true,
        },
      };
      return json;
    });

    await migrate(tree);

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.release).toEqual({
      releaseTag: {
        pattern: 'v{version}',
        checkAllBranchesWhen: true,
      },
    });
  });

  it('should do nothing if no old properties exist', async () => {
    const originalConfig = {
      release: {
        releaseTag: {
          pattern: 'v{version}',
          checkAllBranchesWhen: true,
        },
      },
    };

    updateJson(tree, 'nx.json', (json) => {
      json.release = { ...originalConfig.release };
      return json;
    });

    await migrate(tree);

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.release).toEqual(originalConfig.release);
  });

  it('should do nothing if release config does not exist', async () => {
    updateJson(tree, 'nx.json', (json) => {
      json.namedInputs = {
        default: ['{projectRoot}/**/*'],
      };
      return json;
    });

    await migrate(tree);

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.release).toBeUndefined();
  });

  it('should handle mixed old and new properties across multiple groups', async () => {
    updateJson(tree, 'nx.json', (json) => {
      json.release = {
        groups: {
          'group-1': {
            projects: ['project-1'],
            releaseTagPattern: 'old-{version}',
            releaseTagPatternRequireSemver: true,
          },
          'group-2': {
            projects: ['project-2'],
            releaseTag: {
              pattern: 'new-{version}',
              requireSemver: false,
            },
          },
        },
      };
      return json;
    });

    await migrate(tree);

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.release.groups['group-1']).toEqual({
      projects: ['project-1'],
      releaseTag: {
        pattern: 'old-{version}',
        requireSemver: true,
      },
    });
    expect(nxJson.release.groups['group-2']).toEqual({
      projects: ['project-2'],
      releaseTag: {
        pattern: 'new-{version}',
        requireSemver: false,
      },
    });
  });
});
