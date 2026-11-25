import { getTypescriptBackend } from '@nx/devkit/internal';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { watch as fsWatch } from 'fs';
import {
  existsSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { stripVTControlCharacters } from 'node:util';
import { dirname, join, relative } from 'path';
import { runTypeCheck, runTypeCheckWatch } from './run-type-check';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, watch: vi.fn(actual.watch) };
});

// Real installs: the repo's `typescript` is TS 6, and 7.1 is aliased.
const typescriptInstalls = [
  ['classic', dirname(require.resolve('typescript/package.json'))],
  ['api', dirname(require.resolve('@typescript/native/package.json'))],
] as const;

describe.each(typescriptInstalls)(
  'runTypeCheck with the %s TypeScript backend',
  (backendKind, typescriptDir) => {
    let fs: TempFs;
    let workspaceRoot: string;
    let projectRoot: string;
    let tsConfigPath: string;

    beforeEach(async () => {
      fs = new TempFs('nx-type-check-test');
      workspaceRoot = fs.tempDir;
      projectRoot = join(workspaceRoot, 'proj');
      tsConfigPath = join(workspaceRoot, 'tsconfig.json');
      fs.createDirSync('node_modules');
      symlinkSync(
        typescriptDir,
        join(workspaceRoot, 'node_modules/typescript'),
        'dir'
      );
      await fs.createFiles({
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: 'es2022',
            skipLibCheck: true,
            strict: false,
            incremental: false,
            module: 'esnext',
            moduleResolution: 'bundler',
          },
        }),
      });
      expect(getTypescriptBackend().kind).toBe(backendKind);
    });

    afterEach(() => {
      fs.cleanup();
    });

    it('should find type errors', async () => {
      await fs.createFiles({
        'proj/source-with-errors.ts': `
        const a: number = '1';
        const b: boolean = 0;
      `,
      });
      const result = await runTypeCheck({
        workspaceRoot,
        tsConfigPath,
        mode: 'noEmit',
      });

      expect(result.errors).toHaveLength(2);
    });

    it('should format errors with their location, message chain and code frame', async () => {
      await fs.createFiles({
        'proj/source-with-errors.ts': [
          `type Options = { nested: { count: number } };`,
          `const source = { nested: { count: 'one' } };`,
          `export const options: Options = source;`,
        ].join('\n'),
      });

      const result = await runTypeCheck({
        workspaceRoot,
        tsConfigPath,
        mode: 'noEmit',
      });

      expect(result.errors.map((e) => stripVTControlCharacters(e))).toEqual([
        [
          `proj/source-with-errors.ts:3:14 - error TS2322: Type '{ nested: { count: string; }; }' is not assignable to type 'Options'.`,
          `  The types of 'nested.count' are incompatible between these types.`,
          `    Type 'string' is not assignable to type 'number'.`,
          ``,
          `  1 | type Options = { nested: { count: number } };`,
          `  2 | const source = { nested: { count: 'one' } };`,
          `> 3 | export const options: Options = source;`,
          `    |              ^`,
        ].join('\n'),
      ]);
    });

    it('should report a compiler option error once', async () => {
      await fs.createFiles({
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            skipLibCheck: true,
            module: 'esnext',
            moduleResolution: 'nodenext',
          },
        }),
        'proj/valid-source.ts': `export const msg = 'Hello';`,
      });

      const result = await runTypeCheck({
        workspaceRoot,
        tsConfigPath,
        mode: 'noEmit',
      });

      expect(result.errors.map((e) => stripVTControlCharacters(e))).toEqual([
        `error TS5110: Option 'module' must be set to 'NodeNext' when option 'moduleResolution' is set to 'NodeNext'.\n`,
      ]);
    });

    it.skipIf(backendKind === 'api')(
      'should write the incremental .tsbuildinfo into the provided cache dir, creating nested paths',
      async () => {
        // Callers (e.g. the esbuild executor) pass a per-project cache dir so
        // concurrent type checks don't collide on a single .tsbuildinfo. The
        // util must honor that path even when its parent dirs don't exist yet.
        const cacheDir = join(
          workspaceRoot,
          '.nx',
          'cache',
          'esbuild',
          'apps/app1'
        );
        await fs.createFiles({
          'proj/valid-source.ts': `export const msg = 'Hello';`,
        });

        await runTypeCheck({
          workspaceRoot,
          tsConfigPath,
          mode: 'noEmit',
          incremental: true,
          cacheDir,
        });

        expect(existsSync(join(cacheDir, '.tsbuildinfo'))).toBe(true);
      }
    );

    it('should type-check a baseUrl-less config using ${configDir} paths passed via a relative path', async () => {
      // The relative config path esbuild passes here must not trip TS5090.
      await fs.createFiles({
        'tsconfig.base.json': JSON.stringify({
          compilerOptions: {
            skipLibCheck: true,
            strict: false,
            module: 'esnext',
            moduleResolution: 'bundler',
            paths: {
              '@/*': ['${configDir}/src/*'],
              '~/*': ['${configDir}/src/*'],
            },
          },
        }),
        'proj/tsconfig.json': JSON.stringify({
          extends: '../tsconfig.base.json',
          include: ['src/**/*.ts'],
        }),
        'proj/src/valid-source.ts': `export const msg = 'Hello';`,
      });

      // chdir so the relative tsConfigPath resolves from the workspace root.
      const originalCwd = process.cwd();
      process.chdir(workspaceRoot);
      try {
        const result = await runTypeCheck({
          workspaceRoot,
          tsConfigPath: 'proj/tsconfig.json',
          mode: 'noEmit',
        });

        expect(result.errors).toHaveLength(0);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should support emitting declarations', async () => {
      const outDir = join(workspaceRoot, 'dist');
      await fs.createFiles({
        'proj/valid-source.ts': `
        export const msg = 'Hello';
      `,
      });

      await runTypeCheck({
        workspaceRoot,
        tsConfigPath,
        mode: 'emitDeclarationOnly',
        outDir,
        rootDir: projectRoot,
      });

      const content = readFileSync(
        join(outDir, 'valid-source.d.ts')
      ).toString();
      expect(content).toMatch('export declare const msg = "Hello"');
    });

    it('should resolve a relative outDir against the cwd', async () => {
      await fs.createFiles({
        'proj/valid-source.ts': `export const msg = 'Hello';`,
      });

      const originalCwd = process.cwd();
      process.chdir(projectRoot);
      try {
        await runTypeCheck({
          workspaceRoot,
          tsConfigPath,
          mode: 'emitDeclarationOnly',
          outDir: 'dist',
          rootDir: projectRoot,
        });
      } finally {
        process.chdir(originalCwd);
      }

      expect(existsSync(join(projectRoot, 'dist/valid-source.d.ts'))).toBe(
        true
      );
    });

    it('should report watch statuses and rebuild declarations when a file changes', async () => {
      const outDir = join(workspaceRoot, 'dist');
      await fs.createFiles({
        'proj/source.ts': `export const value: number = 'one';`,
      });
      const statuses: [number, string, number | undefined][] = [];
      let stdout = '';
      const write = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation((chunk) => {
          stdout += chunk;
          return true;
        });
      let watch: Awaited<ReturnType<typeof runTypeCheckWatch>>;
      try {
        watch = await runTypeCheckWatch(
          {
            workspaceRoot,
            tsConfigPath,
            mode: 'emitDeclarationOnly',
            outDir,
            rootDir: projectRoot,
          },
          (diagnostic, formattedDiagnostic, errorCount) => {
            statuses.push([
              diagnostic.code,
              stripVTControlCharacters(formattedDiagnostic),
              errorCount,
            ]);
          }
        );
        expect(
          watch.preEmitErrors.map((e) => stripVTControlCharacters(e))
        ).toEqual([
          expect.stringMatching(/^proj\/source\.ts:1:14 - error TS2322:/),
        ]);

        // On macOS, fs.watch misses a change made right after it starts.
        await new Promise((resolve) => setTimeout(resolve, 500));
        writeFileSync(
          join(projectRoot, 'source.ts'),
          `export const value = 1;`
        );
        await vi.waitFor(() => expect(statuses).toHaveLength(4), {
          timeout: 10_000,
          interval: 50,
        });
      } finally {
        watch?.close();
        write.mockRestore();
      }

      expect(statuses).toEqual([
        [6031, 'info: Starting compilation in watch mode...\n', undefined],
        [6193, 'info: Found 1 error. Watching for file changes.\n', 1],
        [
          6032,
          'info: File change detected. Starting incremental compilation...\n',
          undefined,
        ],
        [6194, 'info: Found 0 errors. Watching for file changes.\n', 0],
      ]);
      expect(
        stdout
          .replaceAll('\x1B[2J\x1B[3J\x1B[H', '<clear screen>')
          .replaceAll(
            relative(process.cwd(), join(projectRoot, 'source.ts')),
            '<source.ts>'
          )
          .replace(/\d{1,2}:\d{2}:\d{2}(?:\s[AP]M)?/g, '<time>')
      ).toMatchInlineSnapshot(`
        "<clear screen><time> - Starting compilation in watch mode...

        <source.ts>(1,14): error TS2322: Type 'string' is not assignable to type 'number'.

        <time> - Found 1 error. Watching for file changes.
        <clear screen><time> - File change detected. Starting incremental compilation...


        <time> - Found 0 errors. Watching for file changes.
        "
      `);
      expect(readFileSync(join(outDir, 'source.d.ts'), 'utf-8')).toMatch(
        'export declare const value = 1;'
      );
    });

    // The classic backend runs TypeScript 6's own watch program, so these cover
    // only the 7.1 watcher.
    const itWithApiWatcher = it.skipIf(backendKind === 'classic');

    itWithApiWatcher.each([
      {
        target: 'a missing file',
        source: `import { value } from './lib/missing';`,
        existingDirectory: undefined,
        createdFile: 'proj/lib/missing.ts',
      },
      {
        target: 'an index file in an existing directory',
        source: `import { value } from './lib';`,
        existingDirectory: 'proj/lib',
        createdFile: 'proj/lib/index.ts',
      },
      {
        target: 'a missing file imported after a byte order mark',
        source: `\uFEFFimport { value } from './lib/missing';`,
        existingDirectory: undefined,
        createdFile: 'proj/lib/missing.ts',
      },
    ])(
      'should rebuild when $target is created',
      async ({ source, existingDirectory, createdFile }) => {
        if (existingDirectory) {
          fs.createDirSync(existingDirectory);
        }
        await fs.createFiles({
          'proj/source.ts': `${source}\nexport const result: number = value;`,
        });
        const statuses: [number, number | undefined][] = [];
        const write = vi
          .spyOn(process.stdout, 'write')
          .mockImplementation(() => true);
        let watch: Awaited<ReturnType<typeof runTypeCheckWatch>>;
        try {
          watch = await runTypeCheckWatch(
            {
              workspaceRoot,
              tsConfigPath,
              mode: 'noEmit',
              rootDir: projectRoot,
            },
            (diagnostic, _formattedDiagnostic, errorCount) => {
              statuses.push([diagnostic.code, errorCount]);
            }
          );
          expect(statuses).toEqual([
            [6031, undefined],
            [6193, 1],
          ]);

          // On macOS, fs.watch misses a change made right after it starts.
          await new Promise((resolve) => setTimeout(resolve, 500));
          await fs.createFiles({ [createdFile]: `export const value = 1;` });
          await vi.waitFor(() => expect(statuses.at(-1)).toEqual([6194, 0]), {
            timeout: 10_000,
            interval: 50,
          });
        } finally {
          watch?.close();
          write.mockRestore();
        }
      }
    );

    itWithApiWatcher(
      'should not rebuild when the emit writes next to an unresolved import',
      async () => {
        const outDir = join(workspaceRoot, 'dist');
        // `linked` points at dist, and dist/source.d.ts, which each emit
        // rewrites, shares the import's name.
        const source = `import { value } from '../linked/source.mjs';\nexport const result: number = value;`;
        fs.createDirSync('dist');
        symlinkSync(outDir, join(workspaceRoot, 'linked'), 'dir');
        await fs.createFiles({ 'proj/source.ts': source });
        const statuses: number[] = [];
        let editStatuses: number;
        const write = vi
          .spyOn(process.stdout, 'write')
          .mockImplementation(() => true);
        let watch: Awaited<ReturnType<typeof runTypeCheckWatch>>;
        try {
          watch = await runTypeCheckWatch(
            {
              workspaceRoot,
              tsConfigPath,
              mode: 'emitDeclarationOnly',
              outDir,
              rootDir: projectRoot,
            },
            (diagnostic) => {
              statuses.push(diagnostic.code);
            }
          );

          // On macOS, fs.watch misses a change made right after it starts. A
          // directory watcher that fails falls back to polling within this wait,
          // which costs one rebuild.
          await new Promise((resolve) => setTimeout(resolve, 500));
          editStatuses = statuses.length;
          writeFileSync(
            join(projectRoot, 'source.ts'),
            `${source}\nexport const other = 1;`
          );
          await vi.waitFor(
            () => expect(statuses).toHaveLength(editStatuses + 2),
            { timeout: 10_000, interval: 50 }
          );
          // The rebuild rewrote dist/source.d.ts; a rebuild that triggered would
          // show within this wait.
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } finally {
          watch?.close();
          write.mockRestore();
        }

        expect(statuses.slice(editStatuses)).toEqual([6032, 6193]);
      }
    );

    itWithApiWatcher(
      'should poll a directory whose watcher fails',
      async () => {
        const { watch: actualWatch } =
          await vi.importActual<typeof import('fs')>('fs');
        // Fails every directory watcher right away, as EMFILE does.
        vi.mocked(fsWatch).mockImplementation(((watchedPath, ...args) => {
          const watcher = actualWatch(watchedPath, ...args);
          if (statSync(watchedPath).isDirectory()) {
            process.nextTick(() =>
              watcher.emit(
                'error',
                Object.assign(new Error('EMFILE: too many open files, watch'), {
                  code: 'EMFILE',
                })
              )
            );
          }
          return watcher;
        }) as typeof fsWatch);
        await fs.createFiles({
          'proj/source.ts': `import { value } from './lib/missing';\nexport const result: number = value;`,
        });
        const statuses: [number, number | undefined][] = [];
        const write = vi
          .spyOn(process.stdout, 'write')
          .mockImplementation(() => true);
        let watch: Awaited<ReturnType<typeof runTypeCheckWatch>>;
        try {
          watch = await runTypeCheckWatch(
            {
              workspaceRoot,
              tsConfigPath,
              mode: 'noEmit',
              rootDir: projectRoot,
            },
            (diagnostic, _formattedDiagnostic, errorCount) => {
              statuses.push([diagnostic.code, errorCount]);
            }
          );

          // A watcher that keeps retrying would rebuild again within this wait.
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await fs.createFiles({
            'proj/lib/missing.ts': `export const value = 1;`,
          });
          await vi.waitFor(() => expect(statuses.at(-1)).toEqual([6194, 0]), {
            timeout: 10_000,
            interval: 50,
          });
        } finally {
          watch?.close();
          write.mockRestore();
          vi.mocked(fsWatch).mockImplementation(actualWatch);
        }

        // One rebuild for the failed watcher, one for the created file.
        expect(statuses).toEqual([
          [6031, undefined],
          [6193, 1],
          [6032, undefined],
          [6193, 1],
          [6032, undefined],
          [6194, 0],
        ]);
      }
    );
  }
);
