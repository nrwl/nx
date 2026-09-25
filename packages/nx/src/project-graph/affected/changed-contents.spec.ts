import { describe, expect, it, vi } from 'vitest';

const root = vi.hoisted(() => ({
  name: 'tsconfig.base.json' as string | null,
}));
vi.mock('../../plugins/js/utils/typescript', () => ({
  getRootTsConfigFileName: () => root.name,
}));

import { tsConfigChange } from './changed-contents';

const args = { base: 'base', head: 'head' };

function reader(files: Record<string, { base?: unknown; head?: unknown }>) {
  return (file: string, revision: string | void) => {
    const value = files[file]?.[revision === 'base' ? 'base' : 'head'];
    return value === undefined ? '' : JSON.stringify(value);
  };
}

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
