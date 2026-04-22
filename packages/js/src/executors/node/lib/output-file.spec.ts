import { getOutputFileName } from './output-file';

describe('getOutputFileName', () => {
  it('does not double-prefix outputPath when main is already inside the build output', () => {
    expect(
      getOutputFileName({
        buildTargetExecutor: '@nx/js:tsc',
        main: 'packages/failing-project/dist/main.js',
        outputPath: 'packages/failing-project/dist',
        rootDir: 'packages/failing-project',
      })
    ).toBe('main.js');
  });

  it('keeps project-root-relative subdirectories for source entries', () => {
    expect(
      getOutputFileName({
        buildTargetExecutor: '@nx/js:tsc',
        main: 'packages/failing-project/src/main.ts',
        outputPath: 'dist/packages/failing-project',
        rootDir: 'packages/failing-project',
      })
    ).toBe('src/main.js');
  });

  it('preserves nested subdirectories that already live under outputPath', () => {
    expect(
      getOutputFileName({
        buildTargetExecutor: '@nx/js:swc',
        main: 'packages/failing-project/dist/server/main.js',
        outputPath: 'packages/failing-project/dist',
        rootDir: 'packages/failing-project',
      })
    ).toBe('server/main.js');
  });

  it('resolves main relative to rootDir when tsc strips the rootDir prefix from the output', () => {
    expect(
      getOutputFileName({
        buildTargetExecutor: '@nx/js:tsc',
        main: 'apps/project_a/src/main.ts',
        outputPath: 'dist/apps/project_a',
        rootDir: 'apps/project_a/src',
      })
    ).toBe('main.js');
  });
});
