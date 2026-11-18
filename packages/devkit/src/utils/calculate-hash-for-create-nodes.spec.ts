const workspaceContext = vi.hoisted(() => ({
  hashWithWorkspaceContext: vi.fn(async () => 'files'),
  hashMultiGlobWithWorkspaceContext: vi.fn(
    async (_: string, globs: string[][]) => globs.map(() => 'files')
  ),
}));

// Joining with the platform path would build `libs\a\**\*` on Windows, where
// Nx reads `\` as an escape, so the hash would match no files.
vi.mock(
  'path',
  async () =>
    (await vi.importActual<typeof import('node:path')>('node:path')).win32
);
vi.mock(
  'node:path',
  async () =>
    (await vi.importActual<typeof import('node:path')>('node:path')).win32
);
vi.mock('nx/src/devkit-internals', () => ({
  ...workspaceContext,
  hashObject: () => 'options',
}));

import {
  calculateHashForCreateNodes,
  calculateHashesForCreateNodes,
} from './calculate-hash-for-create-nodes';

describe('calculate hash for create nodes', () => {
  const context = { workspaceRoot: '/root' } as any;

  it('globs a project with / even where the platform separator is \\', async () => {
    await calculateHashForCreateNodes('libs/a', {}, context);
    await calculateHashesForCreateNodes(['libs/a', 'libs/b'], {}, context);

    expect(workspaceContext.hashWithWorkspaceContext).toHaveBeenCalledWith(
      '/root',
      ['libs/a/**/*']
    );
    expect(
      workspaceContext.hashMultiGlobWithWorkspaceContext
    ).toHaveBeenCalledWith('/root', [['libs/a/**/*'], ['libs/b/**/*']]);
  });
});
