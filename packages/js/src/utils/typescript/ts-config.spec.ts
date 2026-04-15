import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { readTsConfigPaths, resolvePathsBaseUrl } from './ts-config';
import { join } from 'path';

describe('resolvePathsBaseUrl', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('resolve-paths-base-url', false);
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  it('should return the directory of the tsconfig that defines paths', () => {
    tempFs.createFileSync(
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: { paths: { '@app/*': ['./src/*'] } },
      })
    );

    expect(resolvePathsBaseUrl(join(tempFs.tempDir, 'tsconfig.json'))).toBe(
      tempFs.tempDir
    );
  });

  it('should return resolved baseUrl when baseUrl and paths are in the same tsconfig', () => {
    tempFs.createFileSync(
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@app/*': ['src/*'] },
        },
      })
    );

    expect(resolvePathsBaseUrl(join(tempFs.tempDir, 'tsconfig.json'))).toBe(
      tempFs.tempDir
    );
  });

  it('should resolve non-dot baseUrl relative to its tsconfig directory', () => {
    tempFs.createFileSync(
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: {
          baseUrl: 'src',
          paths: { '@app/*': ['app/*'] },
        },
      })
    );

    expect(resolvePathsBaseUrl(join(tempFs.tempDir, 'tsconfig.json'))).toBe(
      join(tempFs.tempDir, 'src')
    );
  });

  it('should walk extends chain to find paths in parent', () => {
    tempFs.createFileSync(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: { paths: { '@lib/*': ['libs/*/src/index.ts'] } },
      })
    );
    tempFs.createFileSync(
      'tsconfig.json',
      JSON.stringify({ extends: './tsconfig.base.json' })
    );

    expect(resolvePathsBaseUrl(join(tempFs.tempDir, 'tsconfig.json'))).toBe(
      tempFs.tempDir
    );
  });

  it('should use baseUrl from parent when paths are in parent', () => {
    tempFs.createFileSync(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@lib/*': ['libs/*/src/index.ts'] },
        },
      })
    );
    tempFs.createFileSync(
      'tsconfig.json',
      JSON.stringify({ extends: './tsconfig.base.json' })
    );

    expect(resolvePathsBaseUrl(join(tempFs.tempDir, 'tsconfig.json'))).toBe(
      tempFs.tempDir
    );
  });

  it('should use baseUrl from parent when paths are in child', () => {
    tempFs.createFileSync(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: { baseUrl: '.' },
      })
    );
    tempFs.createFileSync(
      'project/tsconfig.json',
      JSON.stringify({
        extends: '../tsconfig.base.json',
        compilerOptions: { paths: { '@app/*': ['src/*'] } },
      })
    );

    expect(
      resolvePathsBaseUrl(join(tempFs.tempDir, 'project', 'tsconfig.json'))
    ).toBe(tempFs.tempDir);
  });

  it('should ignore child baseUrl override when paths are in parent', () => {
    tempFs.createFileSync(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@lib/*': ['libs/*'] },
        },
      })
    );
    tempFs.createFileSync(
      'project/tsconfig.json',
      JSON.stringify({
        extends: '../tsconfig.base.json',
        compilerOptions: { baseUrl: 'src' },
      })
    );

    // Child's baseUrl:'src' is ignored because paths are defined in the
    // parent. The parent's baseUrl:'.' (= tempDir) is used.
    expect(
      resolvePathsBaseUrl(join(tempFs.tempDir, 'project', 'tsconfig.json'))
    ).toBe(tempFs.tempDir);
  });

  it('should use baseUrl from paths-defining tsconfig with non-dot value', () => {
    tempFs.createFileSync(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          baseUrl: 'src',
          paths: { '@app/*': ['app/*'] },
        },
      })
    );
    tempFs.createFileSync(
      'project/tsconfig.json',
      JSON.stringify({ extends: '../tsconfig.base.json' })
    );

    expect(
      resolvePathsBaseUrl(join(tempFs.tempDir, 'project', 'tsconfig.json'))
    ).toBe(join(tempFs.tempDir, 'src'));
  });

  it('should handle deep extends chains', () => {
    tempFs.createFileSync(
      'tsconfig.root.json',
      JSON.stringify({
        compilerOptions: { paths: { '@lib/*': ['libs/*'] } },
      })
    );
    tempFs.createFileSync(
      'tsconfig.base.json',
      JSON.stringify({ extends: './tsconfig.root.json' })
    );
    tempFs.createFileSync(
      'project/tsconfig.json',
      JSON.stringify({ extends: '../tsconfig.base.json' })
    );

    expect(
      resolvePathsBaseUrl(join(tempFs.tempDir, 'project', 'tsconfig.json'))
    ).toBe(tempFs.tempDir);
  });

  it('should handle array extends', () => {
    tempFs.createFileSync(
      'tsconfig.paths.json',
      JSON.stringify({
        compilerOptions: { paths: { '@lib/*': ['libs/*'] } },
      })
    );
    tempFs.createFileSync(
      'tsconfig.strict.json',
      JSON.stringify({
        compilerOptions: { strict: true },
      })
    );
    tempFs.createFileSync(
      'tsconfig.json',
      JSON.stringify({
        extends: ['./tsconfig.paths.json', './tsconfig.strict.json'],
      })
    );

    expect(resolvePathsBaseUrl(join(tempFs.tempDir, 'tsconfig.json'))).toBe(
      tempFs.tempDir
    );
  });

  it('should return tsconfig directory when no paths or baseUrl exist', () => {
    tempFs.createFileSync(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: {} })
    );

    expect(resolvePathsBaseUrl(join(tempFs.tempDir, 'tsconfig.json'))).toBe(
      tempFs.tempDir
    );
  });

  it('should return tsconfig directory for non-existent file', () => {
    expect(resolvePathsBaseUrl(join(tempFs.tempDir, 'nonexistent.json'))).toBe(
      tempFs.tempDir
    );
  });
});

describe('readTsConfigPaths', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('read-ts-config-paths', false);
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  it('should return paths defined in the tsconfig', () => {
    tempFs.createFileSync(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@app/*': ['libs/app/src/*'] },
        },
      })
    );

    const paths = readTsConfigPaths(join(tempFs.tempDir, 'tsconfig.base.json'));

    expect(paths).toEqual({
      '@app/*': ['libs/app/src/*'],
    });
  });

  it('should return paths inherited via extends', () => {
    tempFs.createFileSync(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@lib/*': ['libs/*/src/index.ts'] },
        },
      })
    );
    tempFs.createFileSync(
      'tsconfig.json',
      JSON.stringify({ extends: './tsconfig.base.json' })
    );

    const paths = readTsConfigPaths(join(tempFs.tempDir, 'tsconfig.json'));

    expect(paths).toEqual({
      '@lib/*': ['libs/*/src/index.ts'],
    });
  });

  it('should return null when paths are not defined', () => {
    tempFs.createFileSync(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: {} })
    );

    expect(readTsConfigPaths(join(tempFs.tempDir, 'tsconfig.json'))).toBeNull();
  });
});
