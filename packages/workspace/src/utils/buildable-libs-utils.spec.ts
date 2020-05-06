import {
  DependentBuildableProjectNode,
  updatePaths,
} from './buildable-libs-utils';

describe('updatePaths', () => {
  const deps: DependentBuildableProjectNode[] = [
    { name: '@proj/lib', node: {} as any, outputs: ['dist/libs/lib'] },
  ];

  it('should add path', () => {
    const paths: Record<string, string[]> = {
      '@proj/test': ['libs/test/src/index.ts'],
    };
    updatePaths(deps, paths);
    expect(paths).toEqual({
      '@proj/lib': ['dist/libs/lib'],
      '@proj/test': ['libs/test/src/index.ts'],
    });
  });

  it('should replace paths', () => {
    const paths: Record<string, string[]> = {
      '@proj/lib': ['libs/lib/src/index.ts'],
      '@proj/lib/sub': ['libs/lib/sub/src/index.ts'],
    };
    updatePaths(deps, paths);
    expect(paths).toEqual({
      '@proj/lib': ['dist/libs/lib'],
      '@proj/lib/sub': ['dist/libs/lib/sub'],
    });
  });
});
