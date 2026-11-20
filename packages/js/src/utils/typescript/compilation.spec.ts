import { logger } from '@nx/devkit';
import { getTypescriptBackend } from '@nx/devkit/internal';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { existsSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { stripVTControlCharacters } from 'node:util';
import { dirname, join, relative } from 'path';
import { compileTypeScript, compileTypeScriptWatcher } from './compilation';

// Real installs: the repo's `typescript` is TS 6, and 7.1 is aliased.
const typescriptInstalls = [
  ['classic', dirname(require.resolve('typescript/package.json'))],
  ['api', dirname(require.resolve('@typescript/native/package.json'))],
] as const;

describe.each(typescriptInstalls)(
  'compileTypeScript with the %s TypeScript backend',
  (backendKind, typescriptDir) => {
    let fs: TempFs;
    let workspaceRoot: string;
    let projectRoot: string;
    let outputPath: string;
    let tsConfig: string;

    beforeEach(async () => {
      fs = new TempFs('nx-compile-typescript-test');
      workspaceRoot = fs.tempDir;
      projectRoot = join(workspaceRoot, 'libs/a');
      outputPath = join(workspaceRoot, 'dist/libs/a');
      tsConfig = join(projectRoot, 'tsconfig.lib.json');
      fs.createDirSync('node_modules');
      symlinkSync(
        typescriptDir,
        join(workspaceRoot, 'node_modules/typescript'),
        'dir'
      );
      await fs.createFiles({
        'libs/a/tsconfig.lib.json': JSON.stringify({
          compilerOptions: {
            target: 'es2022',
            module: 'esnext',
            moduleResolution: 'bundler',
            declaration: true,
            skipLibCheck: true,
          },
          include: ['src/**/*.ts'],
        }),
        'libs/a/src/index.ts': `export const value: number = 1;`,
      });
      vi.spyOn(logger, 'info').mockImplementation(() => {});
      vi.spyOn(logger, 'error').mockImplementation(() => {});
      expect(getTypescriptBackend().kind).toBe(backendKind);
    });

    afterEach(() => {
      vi.restoreAllMocks();
      fs.cleanup();
    });

    function compile(overrides = {}) {
      return compileTypeScript({
        outputPath,
        projectName: 'a',
        projectRoot,
        rootDir: projectRoot,
        tsConfig,
        ...overrides,
      });
    }

    it('should emit into the output path relative to the rootDir', () => {
      expect(compile()).toEqual({ success: true });

      expect(readFileSync(join(outputPath, 'src/index.js'), 'utf-8')).toMatch(
        'export const value = 1;'
      );
      expect(existsSync(join(outputPath, 'src/index.d.ts'))).toBe(true);
      expect(logger.info).toHaveBeenLastCalledWith(
        'Done compiling TypeScript files for project "a".'
      );
    });

    it('should log the errors and emit nothing when there are type errors', () => {
      writeFileSync(
        join(projectRoot, 'src/index.ts'),
        [
          `export const value: number = 'one';`,
          `export const other: string = 2;`,
        ].join('\n')
      );

      expect(compile()).toEqual({ success: false });

      expect(existsSync(outputPath)).toBe(false);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(
        stripVTControlCharacters(vi.mocked(logger.error).mock.calls[0][0])
          .replaceAll(
            relative(process.cwd(), join(projectRoot, 'src/index.ts')),
            '<index.ts>'
          )
          .replaceAll('\r\n', '\n')
          // `tsc` adds a blank line after each diagnostic.
          .replace(/\n\n+/g, '\n')
      ).toMatchInlineSnapshot(`
        "<index.ts>:1:14 - error TS2322: Type 'string' is not assignable to type 'number'.
        1 export const value: number = 'one';
                       ~~~~~
        <index.ts>:2:14 - error TS2322: Type 'number' is not assignable to type 'string'.
        2 export const other: string = 2;
                       ~~~~~
        "
      `);
    });

    it('should write the build info of an incremental build into the output path', () => {
      writeFileSync(
        tsConfig,
        JSON.stringify({
          compilerOptions: {
            target: 'es2022',
            module: 'esnext',
            moduleResolution: 'bundler',
            incremental: true,
          },
          include: ['src/**/*.ts'],
        })
      );

      expect(compile()).toEqual({ success: true });

      expect(existsSync(join(outputPath, 'tsconfig.tsbuildinfo'))).toBe(true);
    });

    it.runIf(backendKind === 'api')(
      'should fail before deleting the output path when custom transformers are given',
      () => {
        fs.createFileSync('dist/libs/a/previous.js', '');

        expect(() =>
          compile({ getCustomTransformers: () => ({ before: [] }) })
        ).toThrow(
          'Compiling project "a" with custom TypeScript transformers needs the TypeScript 6 API'
        );
        expect(existsSync(join(outputPath, 'previous.js'))).toBe(true);
      }
    );

    it('should report watch statuses and rebuild when a file changes', async () => {
      writeFileSync(
        join(projectRoot, 'src/index.ts'),
        `export const value: number = 'one';`
      );
      const statuses: [number, unknown, number | undefined][] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      let watcher: { close(): void };
      try {
        watcher = compileTypeScriptWatcher(
          {
            outputPath,
            projectName: 'a',
            projectRoot,
            rootDir: projectRoot,
            tsConfig,
          },
          (diagnostic, _newLine, _options, errorCount) => {
            statuses.push([
              diagnostic.code,
              diagnostic.messageText,
              errorCount,
            ]);
          }
        );
        await vi.waitFor(
          () => expect(statuses.length).toBeGreaterThanOrEqual(2),
          { timeout: 10_000, interval: 50 }
        );

        // On macOS, fs.watch misses a change made right after it starts.
        await new Promise((resolve) => setTimeout(resolve, 500));
        writeFileSync(
          join(projectRoot, 'src/index.ts'),
          `export const value = 1;`
        );
        await vi.waitFor(() => expect(statuses.at(-1)?.[0]).toBe(6194), {
          timeout: 10_000,
          interval: 50,
        });
      } finally {
        watcher?.close();
      }

      // Under load, `tsc` can rebuild once more before the change.
      expect(statuses.slice(0, 2)).toEqual([
        [6031, 'Starting compilation in watch mode...', undefined],
        [6193, 'Found 1 error. Watching for file changes.', 1],
      ]);
      expect(statuses.slice(-2)).toEqual([
        [
          6032,
          'File change detected. Starting incremental compilation...',
          undefined,
        ],
        [6194, 'Found 0 errors. Watching for file changes.', 0],
      ]);
      expect(readFileSync(join(outputPath, 'src/index.js'), 'utf-8')).toMatch(
        'export const value = 1;'
      );
    });
  }
);
