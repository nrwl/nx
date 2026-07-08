import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { FsTree } from 'nx/src/generators/tree';
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import {
  createTreeParseConfigHost,
  readTsConfigPaths,
  resolvePathsBaseUrl,
} from './ts-config';
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

describe('createTreeParseConfigHost', () => {
  let root: string;
  let outside: string;
  let host: ReturnType<typeof createTreeParseConfigHost>;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'tree-host-root-')));
    outside = realpathSync(mkdtempSync(join(tmpdir(), 'tree-host-out-')));
    host = createTreeParseConfigHost(new FsTree(root, false));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it('reads a file resolved outside the workspace root from disk', () => {
    // A base reached through a pnpm store or link:/file: target lives outside
    // tree.root; the fs fallback must still read it.
    const file = join(outside, 'base.json');
    writeFileSync(file, '{ "compilerOptions": { "strict": true } }');

    expect(host.fileExists(file)).toBe(true);
    expect(host.readFile(file)).toContain('strict');
  });

  it('treats an out-of-root directory as a non-file without throwing', () => {
    // ts.sys gates fileExists/readFile on isFile; a bare existsSync would call
    // it a file and readFileSync would throw EISDIR (TS5012), which the
    // extends-failure guard does not catch.
    const dir = join(outside, 'somedir');
    mkdirSync(dir);

    expect(host.fileExists(dir)).toBe(false);
    expect(host.readFile(dir)).toBeUndefined();
    expect(host.directoryExists(dir)).toBe(true);
  });

  it('treats an in-root directory as a non-file so an extension-less extends falls through to its .json sibling', () => {
    // `tree.exists` answers true for a directory; without the `isFile` gate an
    // extension-less `extends` ("./config") next to a `config/` directory would
    // resolve to the directory, read as nothing, and drop the base options.
    mkdirSync(join(root, 'config'));
    writeFileSync(
      join(root, 'config.json'),
      '{ "compilerOptions": { "strict": true } }'
    );

    expect(host.fileExists(join(root, 'config'))).toBe(false);
    expect(host.directoryExists(join(root, 'config'))).toBe(true);
    expect(host.fileExists(join(root, 'config.json'))).toBe(true);
  });
});
