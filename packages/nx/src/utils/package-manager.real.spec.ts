import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPackageManagerVersion } from './package-manager';

const { packageManager } = JSON.parse(
  readFileSync(join(__dirname, '../../../../package.json'), 'utf-8')
) as { packageManager: string };

it('detects the pnpm version without creating temporary workspace files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nx-pnpm-version-'));
  const workspace = join(directory, 'workspace');

  try {
    mkdirSync(workspace);
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ packageManager })
    );
    writeFileSync(join(workspace, 'package.json'), '{}');
    vi.stubEnv('COREPACK_ENABLE_PROJECT_SPEC', '1');
    vi.stubEnv('COREPACK_ENABLE_NETWORK', '0');
    vi.stubEnv('COREPACK_ENABLE_AUTO_PIN', '0');
    vi.stubEnv('XDG_CONFIG_HOME', join(directory, 'config'));
    vi.stubEnv('PNPM_HOME', join(directory, 'pnpm'));
    vi.stubEnv('PNPM_CONFIG_STORE_DIR', undefined);
    vi.stubEnv('pnpm_config_store_dir', undefined);

    // Creating and deleting a temporary file still changes the directory mtime.
    utimesSync(workspace, new Date('2000-01-01'), new Date('2000-01-01'));
    const modifiedBefore = statSync(workspace).mtimeMs;

    expect(getPackageManagerVersion('pnpm', workspace)).toBe(
      packageManager.slice('pnpm@'.length).split('+')[0]
    );
    expect(statSync(workspace).mtimeMs).toBe(modifiedBefore);
  } finally {
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  }
});
