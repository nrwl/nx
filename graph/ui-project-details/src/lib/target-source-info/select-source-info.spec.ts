import { selectSourceInfo } from './select-source-info';

test('selectSourceInfo', () => {
  const map = {
    targets: ['a', 'b'],
    'targets.build': ['c', 'd'],
    'targets.build.options.command': ['e', 'f'],
  };

  expect(selectSourceInfo(map, 'targets')).toEqual(['a', 'b']);
  expect(selectSourceInfo(map, 'targets.build')).toEqual(['c', 'd']);
  expect(selectSourceInfo(map, 'targets.build.options.command')).toEqual([
    'e',
    'f',
  ]);
  // fallback to `targets.build`
  expect(selectSourceInfo(map, 'targets.build.options.cwd')).toEqual([
    'c',
    'd',
  ]);
  // fallback to `targets`
  expect(selectSourceInfo(map, 'targets.echo.options.command')).toEqual([
    'a',
    'b',
  ]);
});
