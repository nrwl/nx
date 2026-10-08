import { prepareProject } from './prepare-project';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
vi.mock('node:fs', async () => ({
  ...(await vi.importActual<any>('node:fs')),
  existsSync: vi.fn(),
}));
vi.mock('@nx/devkit', () => ({
  getPackageManagerCommand: (pm: string) => ({
    exec: pm === 'pnpm' ? 'pnpm exec' : pm === 'npm' ? 'npx' : pm,
  }),
}));

describe('prepareProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
  });
  it.each(['npm', 'yarn', 'pnpm', 'bun'] as const)(
    'passes an explicit app root with %s',
    (pm) => {
      prepareProject('/workspace/my app', '/workspace', pm);
      expect(execFileSync).toHaveBeenCalledWith(
        pm === 'npm' ? 'npx' : pm,
        [
          ...(pm === 'pnpm' ? ['exec'] : []),
          'nuxi',
          'prepare',
          process.platform === 'win32'
            ? '"/workspace/my app"'
            : '/workspace/my app',
        ],
        expect.objectContaining({
          cwd: pm === 'pnpm' ? '/workspace' : '/workspace/my app',
        })
      );
    }
  );
  it('prefers an app-local pnpm binary', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    prepareProject('/workspace/app', '/workspace', 'pnpm');
    expect(execFileSync).toHaveBeenCalledWith(
      'pnpm',
      [
        'exec',
        'nuxi',
        'prepare',
        process.platform === 'win32' ? '"/workspace/app"' : '/workspace/app',
      ],
      expect.objectContaining({ cwd: '/workspace/app' })
    );
  });
});
