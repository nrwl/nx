import type { Mock } from 'vitest';
import { GithubRemoteReleaseClient } from './github';

vi.mock('axios', () => {
  const get = vi.fn();
  return { get, default: { get } };
});

vi.mock('node:child_process', async () => ({
  ...require('node:child_process'),
  execFileSync: vi.fn(),
  execSync: require('node:child_process').execSync,
}));

import { execFileSync } from 'node:child_process';

const axiosGetMock = (await import('axios')).default.get as Mock;
const execFileSyncMock = execFileSync as Mock;

describe('GithubRemoteReleaseClient', () => {
  const client = new GithubRemoteReleaseClient(
    {
      hostname: 'github.com',
      slug: 'nrwl/nx',
      apiBaseUrl: 'https://api.github.com',
    },
    false,
    null
  );

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should prefer the username returned by ungh', async () => {
    axiosGetMock.mockResolvedValue({
      data: {
        user: {
          username: 'from-ungh',
        },
      },
    });
    const authors = new Map<string, { email: Set<string>; username?: string }>([
      ['Test User', { email: new Set(['test@example.com']) }],
    ]);

    await client.applyUsernameToAuthors(authors);

    expect(authors.get('Test User')?.username).toBe('from-ungh');
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('should fall back to gh api when ungh does not return a username', async () => {
    axiosGetMock.mockResolvedValue({
      data: {
        user: null,
      },
    });
    execFileSyncMock.mockReturnValue(
      JSON.stringify({
        items: [{ login: 'from-gh' }],
      })
    );
    const authors = new Map<string, { email: Set<string>; username?: string }>([
      ['Test User', { email: new Set(['test@example.com']) }],
    ]);

    await client.applyUsernameToAuthors(authors);

    expect(authors.get('Test User')?.username).toBe('from-gh');
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'gh',
      [
        'api',
        '--hostname',
        'github.com',
        '--method',
        'GET',
        'search/users',
        '-f',
        'q=test@example.com in:email',
      ],
      expect.objectContaining({
        encoding: 'utf8',
        stdio: 'pipe',
        windowsHide: true,
      })
    );
  });

  it('should fall back to gh api when ungh fails', async () => {
    axiosGetMock.mockRejectedValue(new Error('ungh unavailable'));
    execFileSyncMock.mockReturnValue(
      JSON.stringify({
        items: [{ login: 'from-gh' }],
      })
    );
    const authors = new Map<string, { email: Set<string>; username?: string }>([
      ['Test User', { email: new Set(['test@example.com']) }],
    ]);

    await client.applyUsernameToAuthors(authors);

    expect(authors.get('Test User')?.username).toBe('from-gh');
  });

  it('should skip empty author emails without querying ungh or the gh api', async () => {
    // An empty email makes the ungh lookup URL `https://ungh.cc/users/find/`,
    // so it attributes the commit to the "find" user rather than the real
    // author. It must be skipped entirely.
    const authors = new Map<string, { email: Set<string>; username?: string }>([
      ['Test User', { email: new Set(['']) }],
    ]);

    await client.applyUsernameToAuthors(authors);

    expect(authors.get('Test User')?.username).toBeUndefined();
    expect(axiosGetMock).not.toHaveBeenCalled();
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('should skip non-email author values without querying ungh or the gh api', async () => {
    const authors = new Map<string, { email: Set<string>; username?: string }>([
      ['Test User', { email: new Set(['not-an-email']) }],
    ]);

    await client.applyUsernameToAuthors(authors);

    expect(authors.get('Test User')?.username).toBeUndefined();
    expect(axiosGetMock).not.toHaveBeenCalled();
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('should skip a bad email but still resolve a valid one in the same set', async () => {
    // The guard must `continue` past the empty email, not `break` out of the
    // loop, so a valid email later in the set is still looked up.
    axiosGetMock.mockResolvedValue({
      data: {
        user: {
          username: 'from-ungh',
        },
      },
    });
    const authors = new Map<string, { email: Set<string>; username?: string }>([
      ['Test User', { email: new Set(['', 'test@example.com']) }],
    ]);

    await client.applyUsernameToAuthors(authors);

    expect(authors.get('Test User')?.username).toBe('from-ungh');
    expect(axiosGetMock).toHaveBeenCalledTimes(1);
    expect(axiosGetMock).toHaveBeenCalledWith(
      'https://ungh.cc/users/find/test@example.com'
    );
  });

  it('should leave the username unset when both lookups fail', async () => {
    axiosGetMock.mockRejectedValue(new Error('ungh unavailable'));
    execFileSyncMock.mockImplementation(() => {
      throw new Error('gh unavailable');
    });
    const authors = new Map<string, { email: Set<string>; username?: string }>([
      ['Test User', { email: new Set(['test@example.com']) }],
    ]);

    await expect(
      client.applyUsernameToAuthors(authors)
    ).resolves.toBeUndefined();
    expect(authors.get('Test User')?.username).toBeUndefined();
  });
});
