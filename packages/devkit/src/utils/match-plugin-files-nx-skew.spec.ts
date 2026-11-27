import { matchPluginFiles } from './match-plugin-files';

// An nx that predates `matchPluginFiles` exposes it as `undefined`, not as a
// load error. Explicitly `undefined` because vitest throws on reading an
// export its mock factory did not return.
vi.mock('nx/src/devkit-internals', async () => ({
  ...(await vi.importActual<any>('nx/src/devkit-internals')),
  matchPluginFiles: undefined,
}));

describe('matchPluginFiles against an nx without matchPluginFiles', () => {
  it('guards the simulation itself', async () => {
    const seen: any = await import('nx/src/devkit-internals');
    expect(seen.matchPluginFiles).toBeUndefined();
    expect(seen.findMatchingConfigFiles).toEqual(expect.any(Function));
  });

  it.each([
    [
      { pattern: '**/vite.config.ts' },
      ['apps/a/vite.config.ts', 'libs/b/vite.config.ts'],
    ],
    [
      { include: ['apps/**'] },
      ['apps/a/vite.config.ts', 'apps/a/project.json'],
    ],
    [
      { pattern: '**/vite.config.ts', exclude: ['apps/**'] },
      ['libs/b/vite.config.ts'],
    ],
    [
      {
        pattern: '**/*.json',
        exclude: ['apps/**', '!apps/a/**'],
      },
      ['apps/a/project.json', 'libs/b/project.json'],
    ],
  ])('matches %j', (globs, expected) => {
    const paths = [
      'apps/a/vite.config.ts',
      'apps/a/project.json',
      'libs/b/vite.config.ts',
      'libs/b/project.json',
    ];
    expect(matchPluginFiles(paths, globs)).toEqual(expected);
  });
});
