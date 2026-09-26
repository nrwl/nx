import { mkdtempSync, rmSync, realpathSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { downloadTemplate } from './download-template';

describe('downloadTemplate', () => {
  let tmpDir: string;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-dl-')));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws NETWORK_ERROR with a --preset=empty hint when github.com is unreachable', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.reject(new TypeError('fetch failed'))
    ) as any;

    await expect(
      downloadTemplate('nrwl/empty-template', join(tmpDir, 'proj'))
    ).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: expect.stringMatching(
        /github\.com may be blocked or unreachable/
      ),
    });
    await expect(
      downloadTemplate('nrwl/empty-template', join(tmpDir, 'proj'))
    ).rejects.toMatchObject({
      message: expect.stringMatching(/--preset=empty/),
    });
  });

  it.each([403, 407, 429, 503])(
    'throws NETWORK_ERROR with the hint for HTTP %i (egress blocked by a proxy or transient failure)',
    async (status) => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status, body: null })
      ) as any;

      await expect(
        downloadTemplate('nrwl/empty-template', join(tmpDir, 'proj'))
      ).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: expect.stringMatching(/--preset=empty/),
      });
    }
  );

  it('throws TEMPLATE_CLONE_FAILED without the hint for HTTP 404 (missing repo or branch)', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 404, body: null })
    ) as any;

    await expect(
      downloadTemplate('nrwl/does-not-exist-template', join(tmpDir, 'proj'))
    ).rejects.toMatchObject({
      code: 'TEMPLATE_CLONE_FAILED',
      message: expect.not.stringMatching(/--preset=empty/),
    });
  });
});
