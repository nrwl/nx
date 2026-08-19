import { GithubRemoteReleaseClient } from './github';

jest.mock('../../../../utils/http-client', () => ({
  httpRequest: jest.fn(),
}));

jest.mock('node:child_process', () => ({
  ...jest.requireActual('node:child_process'),
  execFileSync: jest.fn(),
  execSync: jest.requireActual('node:child_process').execSync,
}));

const httpRequestMock = jest.requireMock('../../../../utils/http-client')
  .httpRequest as jest.Mock;
const execFileSyncMock = jest.requireMock('node:child_process')
  .execFileSync as jest.Mock;

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
    jest.resetAllMocks();
  });

  it('should prefer the username returned by ungh', async () => {
    httpRequestMock.mockResolvedValue({
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
    httpRequestMock.mockResolvedValue({
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
    httpRequestMock.mockRejectedValue(new Error('ungh unavailable'));
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
    expect(httpRequestMock).not.toHaveBeenCalled();
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('should skip non-email author values without querying ungh or the gh api', async () => {
    const authors = new Map<string, { email: Set<string>; username?: string }>([
      ['Test User', { email: new Set(['not-an-email']) }],
    ]);

    await client.applyUsernameToAuthors(authors);

    expect(authors.get('Test User')?.username).toBeUndefined();
    expect(httpRequestMock).not.toHaveBeenCalled();
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('should skip a bad email but still resolve a valid one in the same set', async () => {
    // The guard must `continue` past the empty email, not `break` out of the
    // loop, so a valid email later in the set is still looked up.
    httpRequestMock.mockResolvedValue({
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
    expect(httpRequestMock).toHaveBeenCalledTimes(1);
    expect(httpRequestMock).toHaveBeenCalledWith(
      'https://ungh.cc/users/find/test@example.com'
    );
  });

  it('should leave the username unset when both lookups fail', async () => {
    httpRequestMock.mockRejectedValue(new Error('ungh unavailable'));
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
