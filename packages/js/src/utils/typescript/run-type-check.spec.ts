import { getTypescriptBackend } from '@nx/devkit/internal';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import { stripVTControlCharacters } from 'node:util';
import { dirname, join } from 'path';
import { runTypeCheck } from './run-type-check';

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
  }
);
