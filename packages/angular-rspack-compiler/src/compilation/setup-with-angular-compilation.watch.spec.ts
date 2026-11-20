import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { DiagnosticModes, type AngularCompilation } from '../models';
import { setupCompilationWithAngularCompilation } from './setup-with-angular-compilation';

// The loader's `new Function` import has no dynamic import callback under
// vitest; load the same package through the test runner instead.
vi.mock('../utils/load-compiler-cli', () => ({
  loadCompilerCli: () => import('@angular/compiler-cli'),
}));

// The fixture must live on the real filesystem: the package test setup mocks
// `fs` with memfs, but the Angular compilation reads the real one.
let realFs: typeof import('node:fs');
let dir: string;

beforeAll(async () => {
  realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
  dir = realFs.realpathSync(
    realFs.mkdtempSync(join(tmpdir(), 'setup-with-angular-compilation-'))
  );
  vi.stubEnv('NG_BUILD_PARALLEL_TS', '0');
});

afterAll(() => {
  vi.unstubAllEnvs();
  realFs.rmSync(dir, { recursive: true, force: true });
});

it('should apply an edit to a tsconfig the project tsconfig extends indirectly', async () => {
  const writeJson = (file: string, json: unknown) =>
    realFs.writeFileSync(join(dir, file), JSON.stringify(json));
  const writeBaseTsConfig = (noUnusedLocals: boolean) =>
    writeJson('tsconfig.base.json', {
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'bundler',
        noUnusedLocals,
      },
    });
  writeBaseTsConfig(false);
  writeJson('tsconfig.json', { extends: './tsconfig.base.json' });
  writeJson('tsconfig.app.json', {
    extends: './tsconfig.json',
    files: ['main.ts'],
  });
  realFs.writeFileSync(
    join(dir, 'main.ts'),
    'export function f() {\n  const unused = 1;\n}\n'
  );
  const tsConfig = join(dir, 'tsconfig.app.json');
  const setup = (
    angularCompilation?: AngularCompilation,
    modifiedFiles?: Set<string>
  ) =>
    setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: tsConfig } },
      {
        root: dir,
        tsConfig,
        aot: true,
        inlineStyleLanguage: 'css',
        fileReplacements: [],
      },
      undefined,
      angularCompilation,
      modifiedFiles
    );
  const unusedLocalErrors = async (angularCompilation: AngularCompilation) => {
    const { errors = [] } = await angularCompilation.diagnoseFiles(
      DiagnosticModes.All
    );
    return errors.filter((error) => error.text?.includes('TS6133'));
  };

  const { angularCompilation } = await setup();
  try {
    expect(await unusedLocalErrors(angularCompilation)).toHaveLength(0);

    writeBaseTsConfig(true);
    await setup(angularCompilation, new Set([join(dir, 'tsconfig.base.json')]));

    expect(await unusedLocalErrors(angularCompilation)).toHaveLength(1);
  } finally {
    await angularCompilation.close?.();
  }
});
