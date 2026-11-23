import type { CompilerOptions } from 'typescript';
import { join } from 'path';
import { createRequire, Module } from 'node:module';
import { TempFs } from '../../../internal-testing-utils/temp-fs';
import { workspaceRoot } from '../../../utils/workspace-root';
import { registerTsProject } from './register';

// registerTsProject installs process-wide ESM and CJS hooks, so this lives in
// its own spec file to keep them out of register.spec.ts.
describe('registerTsProject', () => {
  const req = createRequire(import.meta.url);
  const swcRegisterPath = req.resolve('@swc-node/register/register');
  let tempFs: TempFs;
  let swcRegister: ReturnType<typeof vi.fn>;
  let readDirectorySpies: ReturnType<typeof vi.spyOn>[];

  beforeEach(() => {
    tempFs = new TempFs('register-ts-project', false);

    swcRegister = vi.fn(() => () => {});
    const stub = new (Module as any)(swcRegisterPath);
    stub.exports = { register: swcRegister };
    stub.loaded = true;
    req.cache[swcRegisterPath] = stub;
    vi.spyOn(Module, 'register').mockImplementation(() => {});

    const typescriptSystems = new Set([
      req('typescript').sys,
      createRequire(req.resolve('@swc-node/register/read-default-tsconfig'))(
        'typescript'
      ).sys,
    ]);
    readDirectorySpies = [...typescriptSystems].map((sys) =>
      vi.spyOn(sys, 'readDirectory')
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete req.cache[swcRegisterPath];
    tempFs.cleanup();
  });

  it('should read swc compiler options without listing the included files', () => {
    tempFs.createFilesSync({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          experimentalDecorators: true,
          paths: { '@lib/a': ['./src/a.ts'] },
        },
        include: ['src/**/*.ts'],
      }),
      'src/a.ts': 'export const a = 1;\n',
    });

    const cleanup = registerTsProject(join(tempFs.tempDir, 'tsconfig.json'));
    cleanup();

    const [compilerOptions] = swcRegister.mock.calls[0] as [CompilerOptions];
    expect(compilerOptions.experimentalDecorators).toBe(true);
    expect(compilerOptions.baseUrl).toBe(workspaceRoot);
    expect(compilerOptions).not.toHaveProperty('files');
    for (const spy of readDirectorySpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
