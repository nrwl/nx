import { TempFs } from '@nx/devkit/internal-testing-utils';
import { join } from 'path';

describe('resolver', () => {
  let fs: TempFs;
  let resolver: (path: string, options: object) => string;

  beforeAll(async () => {
    fs = new TempFs('jest-resolver');
    await fs.createFiles({
      'tsconfig.base.json': JSON.stringify({
        compilerOptions: {
          paths: { '@proj/a': ['./libs/a/src/index.ts'] },
        },
      }),
      'libs/a/src/index.ts': 'export const a = 1;',
      'libs/b/tsconfig.spec.json': JSON.stringify({
        extends: '../../tsconfig.base.json',
      }),
    });
    resolver = require('./resolver');
  });

  afterAll(() => {
    fs.cleanup();
  });

  function resolve(path: string) {
    return resolver(path, {
      rootDir: join(fs.tempDir, 'libs/b/src'),
      basedir: join(fs.tempDir, 'libs/b/src'),
      defaultResolver: () => {
        throw new Error(`Cannot find module '${path}'`);
      },
    });
  }

  it('should fall back to the path aliases of the nearest test tsconfig', () => {
    expect(resolve('@proj/a')).toBe(join(fs.tempDir, 'libs/a/src/index.ts'));
  });

  it('should resolve bare imports from the directory that defines the paths', () => {
    expect(resolve('libs/a/src/index')).toBe(
      join(fs.tempDir, 'libs/a/src/index.ts')
    );
  });

  it('should throw when TypeScript cannot resolve the module either', () => {
    expect(() => resolve('@proj/missing')).toThrow(
      'Could not resolve @proj/missing'
    );
  });
});
