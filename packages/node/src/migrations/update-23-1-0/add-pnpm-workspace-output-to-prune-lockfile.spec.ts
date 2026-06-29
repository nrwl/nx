import {
  addProjectConfiguration,
  detectPackageManager,
  getProjects,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrate from './add-pnpm-workspace-output-to-prune-lockfile';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(),
}));

describe('add-pnpm-workspace-output-to-prune-lockfile migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function addAppWithPruneTarget(name: string, outputs: string[]) {
    addProjectConfiguration(tree, name, {
      root: `apps/${name}`,
      targets: {
        'prune-lockfile': {
          executor: '@nx/js:prune-lockfile',
          outputs,
          options: { buildTarget: 'build' },
        },
      },
    });
  }

  function pruneOutputs(name: string) {
    return getProjects(tree).get(name).targets['prune-lockfile'].outputs;
  }

  it('adds the pnpm-workspace.yaml output for pnpm workspaces', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
    addAppWithPruneTarget('api', [
      '{workspaceRoot}/dist/apps/api/package.json',
      '{workspaceRoot}/dist/apps/api/pnpm-lock.yaml',
    ]);

    await migrate(tree);

    expect(pruneOutputs('api')).toEqual([
      '{workspaceRoot}/dist/apps/api/package.json',
      '{workspaceRoot}/dist/apps/api/pnpm-lock.yaml',
      '{workspaceRoot}/dist/apps/api/pnpm-workspace.yaml',
    ]);
  });

  it('does nothing for non-pnpm workspaces', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('npm');
    const outputs = [
      '{workspaceRoot}/dist/apps/api/package.json',
      '{workspaceRoot}/dist/apps/api/package-lock.json',
    ];
    addAppWithPruneTarget('api', outputs);

    await migrate(tree);

    expect(pruneOutputs('api')).toEqual(outputs);
  });

  it('is idempotent when the output is already present', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
    const outputs = [
      '{workspaceRoot}/dist/apps/api/package.json',
      '{workspaceRoot}/dist/apps/api/pnpm-lock.yaml',
      '{workspaceRoot}/dist/apps/api/pnpm-workspace.yaml',
    ];
    addAppWithPruneTarget('api', outputs);

    await migrate(tree);

    expect(pruneOutputs('api')).toEqual(outputs);
  });

  it('skips prune targets without a package.json output', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
    const outputs = ['{workspaceRoot}/dist/apps/api'];
    addAppWithPruneTarget('api', outputs);

    await migrate(tree);

    expect(pruneOutputs('api')).toEqual(outputs);
  });
});
