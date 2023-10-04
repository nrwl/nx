import { parseParentDirectoriesFromFilePath } from './util';

describe('parseParentDirectoriesFromFilePath', () => {
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
    ['nested-workspace/apps/app1', 'nested-workspace/apps', []],
    ['nested-workspace/libs/lib1', 'nested-workspace/libs', []],
    ['nested-workspace/libs/scope/lib1', 'nested-workspace/libs', ['scope']],
  ];

  test.each(cases)(
    'given filepath %p and workspaceRoot %p, parent directories are %p',
    (path, workspaceRoot, expected) => {
      const result = parseParentDirectoriesFromFilePath(path, workspaceRoot);

      expect(result).toEqual(expected);
    }
  );
});
