import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import type { MockedFunction } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, existsSync: vi.fn() };
});

vi.mock('../utils/workspace-root', () => ({
  workspaceRoot: '/workspace',
  workspaceRootInner: vi.fn(),
}));

import { getBundleInstallDefaultLocation } from './update-manager';

const mockExistsSync = existsSync as MockedFunction<typeof existsSync>;

/** Paths this suite treats as present on disk. */
function stagePresent(paths: string[]) {
  mockExistsSync.mockImplementation((p) => paths.includes(p as string));
}

const NX_JSON = join('/workspace', 'nx.json');

describe('getBundleInstallDefaultLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // NXC-4944: the bundle `require`s a bare `nx`, which resolves only by walking
  // up into the workspace's node_modules. Following `cacheDir` broke that --
  // it is configurable and defaults to `~/.nx/<id>/cache`.
  it('installs inside the workspace so the bundle can resolve a bare `nx`', () => {
    stagePresent([NX_JSON]);

    expect(getBundleInstallDefaultLocation()).toBe(
      join('/workspace', '.nx', 'cache', 'cloud')
    );
  });

  it('reuses the legacy path when the nx-cloud package is installed', () => {
    const legacy = join('/workspace', 'node_modules', '.cache', 'nx', 'cloud');
    stagePresent([NX_JSON, legacy]);

    expect(getBundleInstallDefaultLocation()).toBe(legacy);
  });

  it('falls back to a per-api temp directory outside a workspace', () => {
    stagePresent([]);

    expect(getBundleInstallDefaultLocation()).toMatch(
      new RegExp(`^${join(tmpdir(), 'nx-cloud-client')}.`)
    );
  });
});
