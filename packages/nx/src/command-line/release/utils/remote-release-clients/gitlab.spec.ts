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

    it('should report when no token was configured', async () => {
      const clientWithoutToken = new GitLabRemoteReleaseClient(
        repoData,
        false,
        null
      );

      const printed = await printedErrorBody(clientWithoutToken);

      expect(printed).toContain('Token Header: none');
    });
  });
});
