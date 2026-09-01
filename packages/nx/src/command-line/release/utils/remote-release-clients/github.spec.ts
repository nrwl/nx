import type { Mock } from 'vitest';
import { output } from '../../../../utils/output';
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

vi.mock('../../../../utils/prompt-helpers', () => ({
  selectPrompt: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { selectPrompt } from '../../../../utils/prompt-helpers';

const axiosGetMock = (await import('axios')).default.get as Mock;
const execFileSyncMock = execFileSync as Mock;
const selectPromptMock = selectPrompt as Mock;

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

  describe('handleError', () => {
    const repoData = {
      hostname: 'github.com',
      slug: 'nrwl/nx',
      apiBaseUrl: 'https://api.github.com',
    };

    async function printedErrorBody(
      client: GithubRemoteReleaseClient
    ): Promise<string> {
      const errorSpy = vi.spyOn(output, 'error').mockImplementation(() => {});
      selectPromptMock.mockResolvedValue('No');
      const originalExitCode = process.exitCode;
      try {
        await (client as any).handleError(
          { response: { data: { message: 'Bad credentials' } } },
          { url: 'https://github.com/nrwl/nx/releases/new', requestData: {} }
        );
      } finally {
        process.exitCode = originalExitCode;
      }
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const printed = errorSpy.mock.calls[0][0].bodyLines.join('\n');
      errorSpy.mockRestore();
      return printed;
    }

    it('should redact the token in the API error output', async () => {
      const token = 'ghp_secret';
      const clientWithToken = new GithubRemoteReleaseClient(repoData, false, {
        token,
        headerName: 'Authorization',
      });

      const printed = await printedErrorBody(clientWithToken);

      expect(printed).not.toContain(token);
      expect(printed).toContain(
        'Token Header: Authorization: Bearer <redacted>'
      );
    });

    it('should report when no token was configured', async () => {
      const clientWithoutToken = new GithubRemoteReleaseClient(
        repoData,
        false,
        null
      );

      const printed = await printedErrorBody(clientWithoutToken);

      expect(printed).toContain('Token Header: none');
    });

    it('should redact the token in the unknown-error dump', async () => {
      const token = 'ghp_secret';
      const clientWithToken = new GithubRemoteReleaseClient(repoData, false, {
        token,
        headerName: 'Authorization',
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      selectPromptMock.mockResolvedValue('No');
      const originalExitCode = process.exitCode;

      try {
        await (clientWithToken as any).handleError(
          {
            message: 'Network Error',
            config: { headers: { Authorization: `Bearer ${token}` } },
            request: { _header: `Authorization: Bearer ${token}` },
          },
          { url: 'https://github.com/nrwl/nx/releases/new', requestData: {} }
        );
      } finally {
        process.exitCode = originalExitCode;
      }

      // join() would stringify an object to [object Object], making the
      // not.toContain() assertion below pass vacuously.
      expect(typeof logSpy.mock.calls[0][0]).toBe('string');
      const logged = logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
      expect(logged).not.toContain(token);
      expect(logged).toContain('<redacted>');
      expect(logged).toContain('Network Error');
      logSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should redact the token when it has trailing whitespace', async () => {
      const token = 'ghp_secret';
      // Axios trims header values, so the dump holds the trimmed token while
      // tokenData still carries the untrimmed value read from the environment.
      const clientWithToken = new GithubRemoteReleaseClient(repoData, false, {
        token: `${token}\n`,
        headerName: 'Authorization',
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      selectPromptMock.mockResolvedValue('No');
      const originalExitCode = process.exitCode;

      try {
        await (clientWithToken as any).handleError(
          {
            message: 'Network Error',
            config: { headers: { Authorization: `Bearer ${token}` } },
            request: { _header: `Authorization: Bearer ${token}` },
          },
          { url: 'https://github.com/nrwl/nx/releases/new', requestData: {} }
        );
      } finally {
        process.exitCode = originalExitCode;
      }

      const logged = logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
      expect(logged).not.toContain(token);
      expect(logged).toContain('<redacted>');
      logSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should redact the token when it contains a line break', async () => {
      const token = 'ghp_secret';
      // Node strips CR/LF from outgoing header values, so the dump holds the
      // stripped token while tokenData still carries the line break.
      const clientWithToken = new GithubRemoteReleaseClient(repoData, false, {
        token: `${token.slice(0, 4)}\r\n${token.slice(4)}`,
        headerName: 'Authorization',
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      selectPromptMock.mockResolvedValue('No');
      const originalExitCode = process.exitCode;

      try {
        await (clientWithToken as any).handleError(
          {
            message: 'Network Error',
            config: { headers: { Authorization: `Bearer ${token}` } },
            request: { _header: `Authorization: Bearer ${token}` },
          },
          { url: 'https://github.com/nrwl/nx/releases/new', requestData: {} }
        );
      } finally {
        process.exitCode = originalExitCode;
      }

      expect(typeof logSpy.mock.calls[0][0]).toBe('string');
      const logged = logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
      expect(logged).not.toContain(token);
      expect(logged).toContain('<redacted>');
      logSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
