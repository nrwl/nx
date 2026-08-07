import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runTypeCheck } from './run-type-check';

describe('runTypeCheck', () => {
  let workspaceRoot: string;
  let projectRoot: string;
  let tsConfigPath: string;

  beforeEach(() => {
    workspaceRoot = join(tmpdir(), 'nx-type-check-test');
    projectRoot = join(workspaceRoot, 'proj');
    tsConfigPath = join(workspaceRoot, 'tsconfig.json');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      tsConfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: 'es5',
            skipLibCheck: true,
            strict: false,
            incremental: false,
            module: 'esnext',
            moduleResolution: 'node',
            // TS6 reports deprecated options (target es5, moduleResolution node)
            // as errors; silence them so the test isolates the type errors.
            ignoreDeprecations: '6.0',
          },
        },
        null,
        2
      )
    );
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('should find type errors', async () => {
    writeFileSync(
      join(projectRoot, 'source-with-errors.ts'),
      `
        const a: number = '1';
        const b: boolean = 0;
      `
    );
    const result = await runTypeCheck({
      workspaceRoot,
      tsConfigPath,
      mode: 'noEmit',
    });

    expect(result.errors).toHaveLength(2);
  });

  it('should write the incremental .tsbuildinfo into the provided cache dir, creating nested paths', async () => {
    // Callers (e.g. the esbuild executor) pass a per-project cache dir so
    // concurrent type checks don't collide on a single .tsbuildinfo. The util
    // must honor that path even when its parent dirs don't exist yet.
    const cacheDir = join(
      workspaceRoot,
      '.nx',
      'cache',
      'esbuild',
      'apps/app1'
    );
    writeFileSync(
      join(projectRoot, 'valid-source.ts'),
      `export const msg = 'Hello';`
    );

    await runTypeCheck({
      workspaceRoot,
      tsConfigPath,
      mode: 'noEmit',
      incremental: true,
      cacheDir,
    });

    expect(existsSync(join(cacheDir, '.tsbuildinfo'))).toBe(true);
  });

  it('should type-check a baseUrl-less config using ${configDir} paths passed via a relative path', async () => {
    // The relative config path esbuild passes here must not trip TS5090.
    writeFileSync(
      join(workspaceRoot, 'tsconfig.base.json'),
      JSON.stringify(
        {
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
        },
        null,
        2
      )
    );
    const relativeTsConfigPath = 'proj/tsconfig.json';
    writeFileSync(
      join(workspaceRoot, relativeTsConfigPath),
      JSON.stringify(
        {
          extends: '../tsconfig.base.json',
          include: ['src/**/*.ts'],
        },
        null,
        2
      )
    );
    mkdirSync(join(projectRoot, 'src'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'src', 'valid-source.ts'),
      `export const msg = 'Hello';`
    );

    // chdir so the relative tsConfigPath resolves from the workspace root.
    const originalCwd = process.cwd();
    process.chdir(workspaceRoot);
    try {
      const result = await runTypeCheck({
        workspaceRoot,
        tsConfigPath: relativeTsConfigPath,
        mode: 'noEmit',
      });

      expect(result.errors).toHaveLength(0);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should support emitting declarations', async () => {
    const outDir = join(workspaceRoot, 'dist');
    writeFileSync(
      join(projectRoot, 'valid-source.ts'),
      `
        export const msg = 'Hello';
      `
    );

    await runTypeCheck({
      workspaceRoot,
      tsConfigPath,
      mode: 'emitDeclarationOnly',
      outDir,
    });

    const content = readFileSync(join(outDir, 'valid-source.d.ts')).toString();
    expect(content).toMatch('export declare const msg = "Hello"');
  });
});
