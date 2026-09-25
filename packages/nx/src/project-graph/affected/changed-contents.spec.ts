import { describe, expect, it, vi } from 'vitest';

const root = vi.hoisted(() => ({
  name: 'tsconfig.base.json' as string | null,
}));
vi.mock('../../plugins/js/utils/typescript', () => ({
  getRootTsConfigFileName: () => root.name,
}));

import { jsonFieldChanges, tsConfigChange } from './changed-contents';

const args = { base: 'base', head: 'head' };

function reader(files: Record<string, { base?: unknown; head?: unknown }>) {
  return (file: string, revision: string | void) => {
    const value = files[file]?.[revision === 'base' ? 'base' : 'head'];
    return value === undefined ? '' : JSON.stringify(value);
  };
}

describe('jsonFieldChanges', () => {
  it('lists the leaf field paths that changed', () => {
    const read = reader({
      'package.json': {
        base: { version: '1', scripts: { build: 'a', test: 'b' } },
        head: { version: '2', scripts: { build: 'a', test: 'c' } },
      },
    });
    expect(jsonFieldChanges(['package.json'], args, read)).toEqual([
      {
        file: 'package.json',
        paths: [['version'], ['scripts', 'test']],
      },
    ]);
  });

  // The object turned into a string: its own path, not only its children's.
  it('keeps a change of kind at the path where it happened', () => {
    const read = reader({
      'a.json': { base: { a: { b: 1 } }, head: { a: 'x' } },
    });
    expect(jsonFieldChanges(['a.json'], args, read)[0].paths).toContainEqual([
      'a',
    ]);
  });

  it('compares a file as a whole when it cannot be read as an object', () => {
    const read = reader({
      'added.json': { head: { a: 1 } },
      'list.json': { base: [1], head: [2] },
    });
    expect(
      jsonFieldChanges(['added.json', 'list.json'], args, read).map(
        (change) => change.paths
      )
    ).toEqual([undefined, undefined]);
  });

  it('compares a file named with --files as a whole', () => {
    const read = reader({ 'a.json': { base: { a: 1 }, head: { a: 2 } } });
    expect(
      jsonFieldChanges(['a.json'], { ...args, files: ['a.json'] }, read)[0]
        .paths
    ).toBeUndefined();
  });
});

describe('tsConfigChange', () => {
  const paths = (target: string) => ({ '@ws/a': [target] });

  it('separates a paths-only change from the rest', () => {
    root.name = 'tsconfig.base.json';
    const read = reader({
      'tsconfig.base.json': {
        base: { compilerOptions: { target: 'es2022', paths: paths('a.ts') } },
        head: { compilerOptions: { target: 'es2022', paths: paths('b.ts') } },
      },
    });
    expect(tsConfigChange(['tsconfig.base.json'], args, true, read)).toEqual({
      restChanged: false,
      selective: true,
      pathsBefore: paths('a.ts'),
      pathsAfter: paths('b.ts'),
    });
  });

  it('marks any other change', () => {
    root.name = 'tsconfig.base.json';
    const read = reader({
      'tsconfig.base.json': {
        base: { compilerOptions: { target: 'es2022' } },
        head: { compilerOptions: { target: 'es2023' } },
      },
    });
    expect(
      tsConfigChange(['tsconfig.base.json'], args, false, read).restChanged
    ).toBe(true);
  });

  // Another candidate changing may mean the root switched files.
  it('treats a change to the other tsconfig as a change to everything', () => {
    root.name = 'tsconfig.base.json';
    expect(
      tsConfigChange(['tsconfig.json'], args, true, reader({})).restChanged
    ).toBe(true);
  });

  it('is unset when no root tsconfig changed', () => {
    expect(
      tsConfigChange(['libs/a/tsconfig.json'], args, true)
    ).toBeUndefined();
  });
});
