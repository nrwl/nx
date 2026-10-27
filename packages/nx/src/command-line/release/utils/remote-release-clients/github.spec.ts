import { inspect } from 'node:util';
import type { Mock } from 'vitest';
import { output } from '../../../../utils/output';
import { TempFs } from '../../../../internal-testing-utils/temp-fs';
import { GithubRemoteReleaseClient } from './github';

vi.mock('../../../../utils/http-client', () => ({
  httpRequest: vi.fn(),
}));

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

const httpRequestMock = (await import('../../../../utils/http-client'))
  .httpRequest as Mock;
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

  it.each([
    ['ungh', 'octocat\n\n## 1.0.2'],
    ['ungh', '**octocat**'],
    ['ungh', 42],
    ['gh api', 'octocat\r## 1.0.2'],
  ])(
    'should ignore a username from %s that is not a GitHub login: %j',
    async (source, username) => {
      httpRequestMock.mockResolvedValue({
        data: { user: source === 'ungh' ? { username } : null },
      });
      execFileSyncMock.mockReturnValue(
        JSON.stringify({
          items: source === 'gh api' ? [{ login: username }] : [],
        })
      );
      const authors = new Map<
        string,
        { email: Set<string>; username?: string }
      >([['Test User', { email: new Set(['test@example.com']) }]]);

      await client.applyUsernameToAuthors(authors);

      expect(authors.get('Test User')?.username).toBeUndefined();
    }
  );

  it('should ignore a noreply email whose local part is not a GitHub login', async () => {
    httpRequestMock.mockResolvedValue({ data: { user: null } });
    execFileSyncMock.mockReturnValue(JSON.stringify({ items: [] }));
    const authors = new Map<string, { email: Set<string>; username?: string }>([
      [
        'Mallory',
        {
          email: new Set([
            '12345+mallory\r## 1.0.2\u2028## 1.1.0@users.noreply.github.com',
          ]),
        },
      ],
    ]);

    await client.applyUsernameToAuthors(authors);

    expect(authors.get('Mallory')?.username).toBeUndefined();
  });

  it.each(['octo-cat', 'octocat_corp', 'renovate[bot]'])(
    'should accept the GitHub login %s',
    async (login) => {
      httpRequestMock.mockResolvedValue({
        data: { user: { username: login } },
      });
      const authors = new Map<
        string,
        { email: Set<string>; username?: string }
      >([['Test User', { email: new Set(['test@example.com']) }]]);

      await client.applyUsernameToAuthors(authors);

      expect(authors.get('Test User')?.username).toBe(login);
    }
  );

  describe('resolveTokenData', () => {
    let tempFs: TempFs;
    const originalEnv = process.env;

    beforeEach(() => {
      tempFs = new TempFs('gh-cli-config', false);
      process.env = {
        ...originalEnv,
        XDG_CONFIG_HOME: tempFs.tempDir,
        PATH: tempFs.tempDir,
      };
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;
    });

    afterEach(() => {
      process.env = originalEnv;
      tempFs.cleanup();
    });

    it('should request the gh CLI token for the given hostname', async () => {
      tempFs.createFileSync(
        'gh/hosts.yml',
        `github.com:
    user: personal
    git_protocol: https
ghe.example.com:
    user: work
    git_protocol: https
`
      );
      execFileSyncMock.mockReturnValue('gho_work\n');

      await expect(
        GithubRemoteReleaseClient.resolveTokenData('ghe.example.com')
      ).resolves.toEqual({ token: 'gho_work', headerName: 'Authorization' });
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'gh',
        ['auth', 'token', '--hostname', 'ghe.example.com'],
        expect.any(Object)
      );
    });
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
      // fetch trims header values, so the dump holds the trimmed token while
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

      expect(typeof logSpy.mock.calls[0][0]).toBe('string');
      const logged = logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
      expect(logged).not.toContain(token);
      expect(logged).toContain('<redacted>');
      logSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should redact the token when it contains a line break', async () => {
      const token = 'ghp_secret';
      // Defensive: fetch rejects a CR/LF header outright, so a request cannot
      // produce this pairing. Pins the needle that would cover it if it ever could.
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

    it('should leave the dump untouched when the token is blank', async () => {
      const clientWithToken = new GithubRemoteReleaseClient(repoData, false, {
        token: ' ',
        headerName: 'Authorization',
      });

      const inspected = (clientWithToken as any).inspectWithRedactedToken({
        message: 'Network Error',
      });

      expect(inspected).toBe(inspect({ message: 'Network Error' }));
      expect(inspected).not.toContain('<redacted>');
    });

    it('should redact a long token that inspect splits across lines', async () => {
      // A wrapped paste: inspect() renders the header value as concatenated
      // per-line chunks, which no whole-token needle spans.
      const token = `ghp_secret_${'a'.repeat(60)}`;
      const wrapped = `${token.slice(0, 40)}
${token.slice(40)}`;
      const clientWithToken = new GithubRemoteReleaseClient(repoData, false, {
        token: wrapped,
        headerName: 'Authorization',
      });

      const inspected = (clientWithToken as any).inspectWithRedactedToken({
        config: { headers: { Authorization: `Bearer ${wrapped}` } },
        request: { _header: `Authorization: Bearer ${wrapped}` },
      });

      expect(inspected).not.toContain(token.slice(40));
      expect(inspected).toContain('<redacted>');
    });
  });
});
