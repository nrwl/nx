import { findFile as findFileMain } from './nx-tsconfig-paths-find-file';

describe('@nx/vite nx-tsconfig-paths-find-file', () => {
  const extensions = ['.ts', '.js'];
  const fs = new Set<string>();
  const existsSyncImpl = (path: string) => fs.has(path);
  const findFile = (path: string): string =>
    findFileMain(path, extensions, existsSyncImpl);

  beforeAll(() => {
    [
      '/dir1/file.ts',
      '/dir1/file.suffix.ts',
      '/dir2/inner/index.ts',
      '/dir2/inner/index.js',
      '/dir3/file.js',
      '/dir4/file.css',
      '/dir5/file.suffix.ts.js',
      '/dir6/inner.suffix/index.ts',
    ].forEach((item) => fs.add(item));
  });

  afterAll(() => {
    fs.clear();
  });

  const cases: Array<{
    title: string;
    path: string;
    expected: string | undefined;
  }> = [
    {
      title: 'Should return undefined for missing file',
      path: '/dir10/file',
      expected: undefined,
    },
    {
      title: 'Should return undefined for missing index file',
      path: '/dir10/inner',
      expected: undefined,
    },
    {
      title: 'Should return existing file path with extension',
      path: '/dir1/file',
      expected: '/dir1/file.ts',
    },
    {
      title:
        'Should return correct file in case with same filename but one with suffix',
      path: '/dir1/file.suffix',
      expected: '/dir1/file.suffix.ts',
    },
    {
      title: 'Should return existing file with dir request',
      path: '/dir2/inner',
      expected: '/dir2/inner/index.ts',
    },
    {
      title: 'Should return existing file with index request',
      path: '/dir2/inner/index',
      expected: '/dir2/inner/index.ts',
    },
    {
      title: 'Should return existing file with js extension',
      path: '/dir3/file',
      expected: '/dir3/file.js',
    },
    {
      title: 'Should return undefined for non presented extension',
      path: '/dir4/file',
      expected: undefined,
    },
    {
      title: 'Should return undefined for unknown file',
      path: '/dir5/file.suffix',
      expected: undefined,
    },
    {
      title: 'Should return js file with strange suffix filename',
      path: '/dir5/file.suffix.ts',
      expected: '/dir5/file.suffix.ts.js',
    },
    {
      title: 'Should return index file for dir with suffixed name',
      path: '/dir6/inner.suffix',
      expected: '/dir6/inner.suffix/index.ts',
    },
  ];

  cases.forEach(({ title, path, expected }) => {
    it(title, () => {
      expect(findFile(path)).toEqual(expected);
    });
  });
});
