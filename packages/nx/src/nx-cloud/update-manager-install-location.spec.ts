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

vi.mock('../utils/cache-directory', () => ({
  cacheDir: join('/shared', 'cache'),
  cacheDirectoryForWorkspace: vi.fn(() => join('/workspace', '.nx', 'cache')),
}));

// `isCI` reads ~18 environment variables that the runner sets, so left unmocked
// these rows answer differently in CI than on a laptop.
vi.mock('../utils/is-ci', () => ({ isCI: vi.fn(() => false) }));

import { getBundleInstallDefaultLocation } from './update-manager';
import { isCI } from '../utils/is-ci';

const mockExistsSync = existsSync as MockedFunction<typeof existsSync>;
const mockIsCI = isCI as MockedFunction<typeof isCI>;

/** Paths this suite treats as present on disk. */
function stagePresent(paths: string[]) {
  mockExistsSync.mockImplementation((p) => paths.includes(p as string));
}

const NX_JSON = join('/workspace', 'nx.json');

describe('getBundleInstallDefaultLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCI.mockReturnValue(false);
    stagePresent([NX_JSON]);
  });

  it('shares the per-user root off CI', () => {
    expect(getBundleInstallDefaultLocation()).toBe(
      join('/shared', 'cache', 'cloud')
    );
  });

  // The bundle resolves a bare `nx` by walking up into node_modules, which the
  // shared root cannot reach.
  it('keeps the bundle in the checkout on CI', () => {
    mockIsCI.mockReturnValue(true);

    expect(getBundleInstallDefaultLocation()).toBe(
      join('/workspace', '.nx', 'cache', 'cloud')
    );
  });

  it('reuses the legacy path when the nx-cloud package is installed', () => {
    const legacy = join('/workspace', 'node_modules', '.cache', 'nx', 'cloud');
    stagePresent([NX_JSON, legacy]);
    mockIsCI.mockReturnValue(true);

    expect(getBundleInstallDefaultLocation()).toBe(legacy);
  });

  it('falls back to a per-api temp directory outside a workspace', () => {
    stagePresent([]);

    expect(getBundleInstallDefaultLocation()).toMatch(
      new RegExp(`^${join(tmpdir(), 'nx-cloud-client')}.`)
    );
  });
});
