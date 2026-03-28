import * as path from 'path';
import { getOutputFileName } from './output-file';

describe('getOutputFileName', () => {
  it('does not double-prefix outputPath when main is already inside the build output', () => {
    expect(
      getOutputFileName({
        buildTargetExecutor: '@nx/js:tsc',
        main: 'packages/failing-project/dist/main.js',
        outputPath: 'packages/failing-project/dist',
        projectRoot: 'packages/failing-project',
      })
    ).toBe('main.js');
  });

  it('keeps project-root-relative subdirectories for source entries', () => {
    expect(
      getOutputFileName({
        buildTargetExecutor: '@nx/js:tsc',
        main: 'packages/failing-project/src/main.ts',
        outputPath: 'dist/packages/failing-project',
        projectRoot: 'packages/failing-project',
      })
    ).toBe(path.join('src', 'main.js'));
  });

  it('preserves nested subdirectories that already live under outputPath', () => {
    expect(
      getOutputFileName({
        buildTargetExecutor: '@nx/js:swc',
        main: 'packages/failing-project/dist/server/main.js',
        outputPath: 'packages/failing-project/dist',
        projectRoot: 'packages/failing-project',
      })
    ).toBe(path.join('server', 'main.js'));
  });
});
