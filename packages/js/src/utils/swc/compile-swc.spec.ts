import { NormalizedSwcExecutorOptions } from '../schema';
import { getSwcCmd, getTypeCheckOptions } from './compile-swc';

describe('getSwcCmd', () => {
  const baseOptions = {
    swcCliOptions: {
      swcrcPath: 'apps/demo/.swcrc',
      destPath: '../../dist/apps/demo',
      stripLeadingPaths: false,
    },
    root: '/root',
    projectRoot: 'apps/demo',
  } as NormalizedSwcExecutorOptions;

  it('should compile from sourceRoot when the main entry is inside it', () => {
    const cmd = getSwcCmd({
      ...baseOptions,
      sourceRoot: 'apps/demo/src',
      main: 'apps/demo/src/index.ts',
    });

    expect(cmd).toContain(' src -d ');
  });

  it('should compile from the project root when the main entry is outside sourceRoot', () => {
    const cmd = getSwcCmd({
      ...baseOptions,
      sourceRoot: 'apps/demo/src',
      main: 'apps/demo/server/main.ts',
    });

    expect(cmd).toContain(' . -d ');
  });

  it('should compile from the project root when sourceRoot is the project root', () => {
    const cmd = getSwcCmd({
      ...baseOptions,
      sourceRoot: 'apps/demo',
      main: 'apps/demo/server/main.ts',
    });

    expect(cmd).toContain(' . -d ');
  });
});

describe('getTypeCheckOptions', () => {
  it('should resolve rootDir against the workspace root, not the cwd', () => {
    const options = getTypeCheckOptions({
      swcCliOptions: { stripLeadingPaths: false },
      root: '/root',
      projectRoot: 'libs/demo',
      tsConfig: '/root/libs/demo/tsconfig.lib.json',
      outputPath: '/root/dist/libs/demo',
    } as NormalizedSwcExecutorOptions);

    expect(options.rootDir).toEqual('/root/libs/demo');
  });
});
