import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveSecretArg } from './secrets';

describe('resolveSecretArg', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-docker-secrets-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes a literal secret value to a temp file and returns id=/src=', () => {
    const arg = resolveSecretArg('NPM_TOKEN=abc123', tempDir, false);
    expect(arg).toMatch(/^id=NPM_TOKEN,src=/);
  });

  it('reads a secret file and rewrites its content into the tempDir', () => {
    const secretFile = join(tempDir, 'secret.txt');
    writeFileSync(secretFile, 'file-contents');
    const arg = resolveSecretArg(`MY_SECRET=${secretFile}`, tempDir, true);
    expect(arg).toMatch(/^id=MY_SECRET,src=/);
  });

  it('interpolates an env var reference in a secret-file path', () => {
    const secretFile = join(tempDir, 'npmrc');
    writeFileSync(secretFile, 'registry=https://example.com');
    process.env.NX_DOCKER_TEST_NPMRC_PATH = secretFile;
    const arg = resolveSecretArg(
      'npmrc=$NX_DOCKER_TEST_NPMRC_PATH',
      tempDir,
      true
    );
    expect(arg).toMatch(/^id=npmrc,src=/);
    delete process.env.NX_DOCKER_TEST_NPMRC_PATH;
  });

  it('throws when there is no `=`', () => {
    expect(() => resolveSecretArg('not-a-secret', tempDir, false)).toThrow(
      /not a valid secret/
    );
  });

  it('throws when the value is empty', () => {
    expect(() => resolveSecretArg('KEY=', tempDir, false)).toThrow(
      /not a valid secret/
    );
  });

  it('throws when a secret file does not exist', () => {
    expect(() =>
      resolveSecretArg('KEY=/nonexistent/file', tempDir, true)
    ).toThrow(/not found/);
  });
});
