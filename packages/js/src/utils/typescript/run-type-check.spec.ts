import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
