import { symlinkSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { TempFs } from '../../../internal-testing-utils/temp-fs';

// Real installs: the repo's `typescript` is TS 6, and 7.1 is aliased.
const typescriptInstalls = [
  ['classic', dirname(require.resolve('typescript/package.json'))],
  ['api', dirname(require.resolve('@typescript/native/package.json'))],
] as const;

describe.each(typescriptInstalls)(
  'with the %s TypeScript backend',
  (backendKind, typescriptDir) => {
    let fs: TempFs;
    let typescript: typeof import('./typescript');

    beforeEach(async () => {
      fs = new TempFs('Workspaces');
      fs.createDirSync('node_modules');
      symlinkSync(
        typescriptDir,
        join(fs.tempDir, 'node_modules/typescript'),
        'dir'
      );

      // typescript.ts caches the workspace root and its resolver per module.
      vi.resetModules();
      (await import('../../../utils/workspace-root')).setWorkspaceRoot(
        fs.tempDir
      );
      typescript = await import('./typescript');
      const { getTypescriptBackend } = await import('./typescript-backend');
      expect(getTypescriptBackend().kind).toBe(backendKind);
    });

    afterEach(() => {
      fs.cleanup();
    });

    describe('readTsConfigOptions', () => {
      it('should handle extending local configs', async () => {
        await fs.createFiles({
          'a.json': JSON.stringify({ extends: './b.json' }),
          'b.json': JSON.stringify({ compilerOptions: { strict: true } }),
        });

        expect(
          typescript.readTsConfigOptions(join(fs.tempDir, 'a.json'))
        ).toMatchObject({ strict: true });
      });

      it('should handle extending third-party configs', async () => {
        await fs.createFiles({
          'tsconfig.json': JSON.stringify({
            extends: '@fake-third-party/some-package/tsconfig.json',
          }),
          'node_modules/@fake-third-party/some-package/tsconfig.json':
            JSON.stringify({ compilerOptions: { strict: true } }),
        });

        expect(
          typescript.readTsConfigOptions(join(fs.tempDir, 'tsconfig.json'))
        ).toMatchObject({ strict: true });
      });
    });

    describe('readTsConfigWithoutFiles with a host', () => {
      it('should read the host files and keep relative paths relative', () => {
        const root = join(fs.tempDir, 'not-on-disk');
        const files: Record<string, string> = {
          'tsconfig.base.json': JSON.stringify({
            compilerOptions: {
              strict: true,
              rootDir: '.',
              paths: { '@proj/b': ['libs/b/src/index.ts'] },
            },
          }),
          'libs/a/tsconfig.json': JSON.stringify({
            extends: '../../tsconfig.base.json',
            compilerOptions: {
              outDir: '../../dist/out-tsc',
              typeRoots: ['./types'],
            },
            include: ['src/**/*.ts'],
            references: [{ path: '../b' }],
          }),
          'libs/a/src/index.ts': '',
        };
        const toKey = (path: string) =>
          relative(root, resolve(root, path)).replace(/\\/g, '/');
        const host = {
          getCurrentDirectory: () => root,
          readFile: (path: string) => files[toKey(path)],
          fileExists: (path: string) => toKey(path) in files,
          directoryExists: (path: string) =>
            Object.keys(files).some((file) =>
              file.startsWith(`${toKey(path)}/`)
            ),
        };

        const parsed = typescript.readTsConfigWithoutFiles(
          'libs/a/tsconfig.json',
          host
        );

        expect(parsed.options).toMatchObject({
          strict: true,
          rootDir: '.',
          outDir: 'dist/out-tsc',
          typeRoots: ['libs/a/types'],
        });
        expect(parsed.fileNames).toEqual([]);
        expect(parsed.projectReferences).toEqual([
          expect.objectContaining({ path: 'libs/b', originalPath: '../b' }),
        ]);
      });

      it.runIf(backendKind === 'api')(
        'should rethrow a host error and keep serving later reads',
        async () => {
          await fs.createFiles({
            'tsconfig.json': JSON.stringify({
              compilerOptions: { strict: true },
            }),
          });
          const tsConfigPath = join(fs.tempDir, 'tsconfig.json');
          const hostError = new Error('host failed');

          let error: unknown;
          try {
            typescript.readTsConfigWithoutFiles(tsConfigPath, {
              readFile: () => {
                throw hostError;
              },
            });
          } catch (e) {
            error = e;
          }

          expect(error).toBe(hostError);
          expect(
            typescript.readTsConfigWithoutFiles(tsConfigPath, {}).options
          ).toMatchObject({ strict: true });
        }
      );
    });

    describe('parseTsConfigContent with a host', () => {
      it('should apply the extends chain from the host and keep relative paths relative', () => {
        const root = join(fs.tempDir, 'not-on-disk');
        const files: Record<string, string> = {
          'tsconfig.base.json': JSON.stringify({
            compilerOptions: { strict: true },
          }),
        };
        const toKey = (path: string) =>
          relative(root, resolve(root, path)).replace(/\\/g, '/');
        const host = {
          getCurrentDirectory: () => root,
          readFile: (path: string) => files[toKey(path)],
          fileExists: (path: string) => toKey(path) in files,
        };

        const parsed = typescript.parseTsConfigContent(
          {
            extends: '../../tsconfig.base.json',
            compilerOptions: { outDir: 'dist', target: 'ES2022' },
            files: [],
          },
          'libs/a',
          host
        );

        expect(parsed.options).toMatchObject({
          strict: true,
          outDir: 'libs/a/dist',
          target: 9,
        });
      });
    });

    describe('resolveModuleByImport', () => {
      beforeEach(async () => {
        await fs.createFiles({
          'tsconfig.base.json': JSON.stringify({
            compilerOptions: {
              module: 'nodenext',
              moduleResolution: 'nodenext',
              customConditions: ['development'],
              paths: { '@proj/aliased': ['./libs/aliased/src/index.ts'] },
            },
          }),
          'libs/aliased/src/index.ts': 'export const a = 1;',
          'node_modules/@proj/pkg/package.json': JSON.stringify({
            name: '@proj/pkg',
            exports: {
              '.': {
                development: './src/index.ts',
                default: './dist/index.js',
              },
            },
          }),
          'node_modules/@proj/pkg/src/index.ts': 'export const b = 1;',
          'apps/app/src/main.ts': '',
        });
      });

      it.each([
        ['a tsconfig path alias', '@proj/aliased', 'libs/aliased/src/index.ts'],
        [
          'a package export condition',
          '@proj/pkg',
          'node_modules/@proj/pkg/src/index.ts',
        ],
        ['an unknown package', '@proj/missing', undefined],
      ])('should resolve %s', (_, importExpr, expected) => {
        expect(
          typescript.resolveModuleByImport(
            importExpr,
            join(fs.tempDir, 'apps/app/src/main.ts'),
            join(fs.tempDir, 'tsconfig.base.json')
          )
        ).toBe(expected);
      });
    });
  }
);

describe('getTypescriptBackend', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('Workspaces');
  });

  afterEach(() => {
    fs.cleanup();
  });

  // typescript-backend.ts caches lookups per module and reads the workspace root.
  async function importBackendFor(workspaceRoot: string) {
    vi.resetModules();
    (await import('../../../utils/workspace-root')).setWorkspaceRoot(
      workspaceRoot
    );
    return import('./typescript-backend');
  }

  it('should ignore a typescript installed above the workspace', async () => {
    await fs.createFiles({
      'workspace/nx.json': '{}',
      'node_modules/typescript/package.json': JSON.stringify({
        name: 'typescript',
        version: '5.9.3',
      }),
      'node_modules/typescript/index.js':
        'module.exports = { createSourceFile() {} };',
    });
    const { getTypescriptBackend } = await importBackendFor(
      join(fs.tempDir, 'workspace')
    );

    expect(getTypescriptBackend().packageJsonPath).toBe(
      require.resolve('typescript/package.json')
    );
  });

  it.each([
    ['7.0.2', 'TypeScript 7.0.2 has no programmatic API'],
    ['next', 'Could not read the version of the TypeScript package'],
  ])(
    'should throw a setup error for TypeScript version %s',
    async (version, message) => {
      await fs.createFiles({
        'node_modules/typescript/package.json': JSON.stringify({
          name: 'typescript',
          version,
          exports: {
            '.': './lib/version.cjs',
            './package.json': './package.json',
          },
        }),
        'node_modules/typescript/lib/version.cjs': `module.exports = { version: '${version}' };`,
      });
      const { getTypescriptBackend, TypescriptSetupError } =
        await importBackendFor(fs.tempDir);

      let error: unknown;
      try {
        getTypescriptBackend();
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(TypescriptSetupError);
      expect((error as Error).message).toContain(message);
    }
  );
});
