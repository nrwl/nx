import { parseParentDirectoriesFromPilePath } from './util';

describe('parseParentDirectoriesFromPilePath', () => {
  // path, workspaceRoot, output
  const cases: [string, string, string[]][] = [
    ['apps/app1', 'apps', []],
    ['apps/app1', '', ['apps']],
    ['apps/nested/app1', 'apps', ['nested']],
    ['libs/scope/some-lib', 'libs', ['scope']],
    [
      'libs/very/very/very/deeply/nested/lib',
      'libs',
      ['very', 'very', 'very', 'deeply', 'nested'],
    ],
    ['packages/published', 'packages', []],
    ['packages/published', '', ['packages']],
    ['packages/published', 'libs', ['packages']],
    ['libs/trailing/slash/', 'libs', ['trailing']],
    ['libs/trailing/slash', 'libs/', ['trailing']],
  ];

  test.each(cases)(
    'given filepath %p and workspaceRoot %p, parent directories are %p',
    (path, workspaceRoot, expected) => {
      const result = parseParentDirectoriesFromPilePath(path, workspaceRoot);

      expect(result).toEqual(expected);
    }
  );
});
