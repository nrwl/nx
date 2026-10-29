import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const envAtCacheDirectoryImport = vi.hoisted(() => ({
  value: undefined as string | undefined,
}));

vi.mock('../src/utils/cache-directory', () => {
  envAtCacheDirectoryImport.value = process.env.NX_ALLOW_INSECURE_DIRECTORIES;
  return { workspaceDataDirectoryForWorkspace: (root: string) => root };
});

describe('loadWorkspaceEnv', () => {
  let workspace: string;
  let previousReportDirectory: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'nx-workspace-env-'));
    previousReportDirectory = process.report.directory;
  });

  afterEach(() => {
    process.report.directory = previousReportDirectory;
    delete process.env.NX_ALLOW_INSECURE_DIRECTORIES;
    rmSync(workspace, { recursive: true, force: true });
  });

  it('loads the root .env files before the cache directories are resolved', async () => {
    writeFileSync(
      join(workspace, '.env'),
      'NX_ALLOW_INSECURE_DIRECTORIES=true\n'
    );
    const { loadWorkspaceEnv } = await import('./workspace-env');

    await loadWorkspaceEnv(workspace);

    expect(envAtCacheDirectoryImport.value).toBe('true');
    expect(process.report.directory).toBe(workspace);
  });
});
