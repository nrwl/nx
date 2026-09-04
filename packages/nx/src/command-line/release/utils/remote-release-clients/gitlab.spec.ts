import { inspect } from 'node:util';
import type { Mock } from 'vitest';
import { output } from '../../../../utils/output';
import { GitLabRemoteReleaseClient } from './gitlab';

vi.mock('../../../../utils/prompt-helpers', () => ({
  selectPrompt: vi.fn(),
}));

import { selectPrompt } from '../../../../utils/prompt-helpers';

const selectPromptMock = selectPrompt as Mock;

describe('GitLabRemoteReleaseClient', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('handleError', () => {
    const repoData = {
      hostname: 'gitlab.com',
      slug: 'nrwl/nx',
      apiBaseUrl: 'https://gitlab.com/api/v4',
      projectId: 'nrwl%2Fnx',
    };

    async function printedErrorBody(
      client: GitLabRemoteReleaseClient
    ): Promise<string> {
      const errorSpy = vi.spyOn(output, 'error').mockImplementation(() => {});
      selectPromptMock.mockResolvedValue('No');
      const originalExitCode = process.exitCode;
      try {
        await (client as any).handleError(
          { response: { data: { message: '401 Unauthorized' } } },
          { url: 'https://gitlab.com/nrwl/nx/-/releases/new', requestData: {} }
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
      const token = 'glpat-secret';
      const clientWithToken = new GitLabRemoteReleaseClient(repoData, false, {
        token,
        headerName: 'PRIVATE-TOKEN',
      });

      const printed = await printedErrorBody(clientWithToken);

      expect(printed).not.toContain(token);
      expect(printed).toContain('Token Header: PRIVATE-TOKEN: <redacted>');
    });

    it('should redact a CI_JOB_TOKEN under the JOB-TOKEN header', async () => {
      const token = 'ci-job-token-secret';
      const clientWithToken = new GitLabRemoteReleaseClient(repoData, false, {
        token,
        headerName: 'JOB-TOKEN',
      });

      const printed = await printedErrorBody(clientWithToken);

      expect(printed).not.toContain(token);
      expect(printed).toContain('Token Header: JOB-TOKEN: <redacted>');
    });

    it('should report when no token was configured', async () => {
      const clientWithoutToken = new GitLabRemoteReleaseClient(
        repoData,
        false,
        null
      );

      const printed = await printedErrorBody(clientWithoutToken);

      expect(printed).toContain('Token Header: none');
    });

    it('should redact the token in the unknown-error dump', async () => {
      const token = 'glpat-secret';
      const clientWithToken = new GitLabRemoteReleaseClient(repoData, false, {
        token,
        headerName: 'PRIVATE-TOKEN',
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
            config: { headers: { 'PRIVATE-TOKEN': token } },
            request: { _header: `PRIVATE-TOKEN: ${token}` },
          },
          { url: 'https://gitlab.com/nrwl/nx/-/releases/new', requestData: {} }
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
      const token = 'glpat-secret';
      // Axios trims header values, so the dump holds the trimmed token while
      // tokenData still carries the untrimmed value read from the environment.
      const clientWithToken = new GitLabRemoteReleaseClient(repoData, false, {
        token: `${token}\n`,
        headerName: 'PRIVATE-TOKEN',
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
            config: { headers: { 'PRIVATE-TOKEN': `${token}` } },
            request: { _header: `PRIVATE-TOKEN: ${token}` },
          },
          { url: 'https://gitlab.com/nrwl/nx/-/releases/new', requestData: {} }
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
      const token = 'glpat-secret';
      // Node strips CR/LF from outgoing header values, so the dump holds the
      // stripped token while tokenData still carries the line break.
      const clientWithToken = new GitLabRemoteReleaseClient(repoData, false, {
        token: `${token.slice(0, 4)}\r\n${token.slice(4)}`,
        headerName: 'PRIVATE-TOKEN',
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
            config: { headers: { 'PRIVATE-TOKEN': `${token}` } },
            request: { _header: `PRIVATE-TOKEN: ${token}` },
          },
          { url: 'https://gitlab.com/nrwl/nx/-/releases/new', requestData: {} }
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
      const clientWithToken = new GitLabRemoteReleaseClient(repoData, false, {
        // a single space: the previous guard tested tokenData, not the token,
        // so this split the dump on every space
        token: ' ',
        headerName: 'PRIVATE-TOKEN',
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
      const token = `glpat-secret_${'a'.repeat(60)}`;
      const wrapped = `${token.slice(0, 40)}
${token.slice(40)}`;
      const clientWithToken = new GitLabRemoteReleaseClient(repoData, false, {
        token: wrapped,
        headerName: 'PRIVATE-TOKEN',
      });

      const inspected = (clientWithToken as any).inspectWithRedactedToken({
        config: { headers: { 'PRIVATE-TOKEN': `${wrapped}` } },
        request: { _header: `PRIVATE-TOKEN: ${wrapped}` },
      });

      expect(inspected).not.toContain(token.slice(40));
      expect(inspected).toContain('<redacted>');
    });
  });
});
