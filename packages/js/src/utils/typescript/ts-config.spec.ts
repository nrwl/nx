import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import {
  readTsConfig,
  readTsConfigPaths,
  resolvePathsBaseUrl,
} from './ts-config';
import { isAbsolute, join } from 'path';

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

  it('should handle tsconfig files with // comments (JSONC) in extends chain', () => {
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
      'tsconfig.intermediate.json',
      `{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    // TODO: fix this later
    "strictPropertyInitialization": false
  }
}`
    );
    tempFs.createFileSync(
      'project/tsconfig.json',
      JSON.stringify({
        extends: '../tsconfig.intermediate.json',
      })
    );

    expect(
      resolvePathsBaseUrl(join(tempFs.tempDir, 'project', 'tsconfig.json'))
    ).toBe(tempFs.tempDir);
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

describe('readTsConfig', () => {
  let tempFs: TempFs;
  let originalCwd: string;

  beforeEach(() => {
    tempFs = new TempFs('read-ts-config', false);
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    tempFs.cleanup();
  });

  it('should expand ${configDir} paths to absolute values when a baseUrl-less config is read via a relative path', () => {
    // A relative basePath would leave `paths` non-relative and trip TS5090.
    tempFs.createFileSync(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          paths: {
            '@/*': ['${configDir}/src/*'],
            '~/*': ['${configDir}/src/*'],
          },
        },
      })
    );
    tempFs.createFileSync(
      'proj/tsconfig.json',
      JSON.stringify({
        extends: '../tsconfig.base.json',
        include: ['src/**/*.ts'],
      })
    );
    tempFs.createFileSync('proj/src/index.ts', `export const a = 1;`);

    process.chdir(tempFs.tempDir);
    const parsed = readTsConfig('proj/tsconfig.json');

    expect(parsed.errors).toHaveLength(0);
    for (const values of Object.values(parsed.options.paths ?? {})) {
      for (const value of values) {
        expect(isAbsolute(value)).toBe(true);
      }
    }
  });

  it('should not report option diagnostics for a baseUrl-less ${configDir} config read via a relative path', () => {
    const ts = require('typescript') as typeof import('typescript');
    tempFs.createFileSync(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          skipLibCheck: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          paths: { '@/*': ['${configDir}/src/*'] },
        },
      })
    );
    tempFs.createFileSync(
      'proj/tsconfig.json',
      JSON.stringify({
        extends: '../tsconfig.base.json',
        include: ['src/**/*.ts'],
      })
    );
    tempFs.createFileSync('proj/src/index.ts', `export const a = 1;`);

    process.chdir(tempFs.tempDir);
    const parsed = readTsConfig('proj/tsconfig.json');
    const program = ts.createProgram(parsed.fileNames, {
      ...parsed.options,
      noEmit: true,
    });

    const optionDiagnostics = program.getOptionsDiagnostics();
    expect(optionDiagnostics.map((d) => d.code)).not.toContain(5090);
  });
});
