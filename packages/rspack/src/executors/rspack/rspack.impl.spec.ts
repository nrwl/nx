import { ExecutorContext } from '@nx/devkit';
import { runTypeCheck } from '@nx/js';
import { executeTypeCheck } from './rspack.impl';
import { RspackExecutorSchema } from './schema';

vi.mock('@nx/js', async () => ({
  ...(await vi.importActual<any>('@nx/js')),
  runTypeCheck: vi.fn().mockResolvedValue({ errors: [], warnings: [] }),
  printDiagnostics: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../utils/create-compiler', () => ({
  createCompiler: vi.fn(),
  isMultiCompiler: vi.fn(),
}));

describe('rspack executeTypeCheck', () => {
  afterEach(() => vi.clearAllMocks());

  // TS 6 defaults rootDir to the tsconfig dir, so a workspace lib resolved from
  // source (outside the project) fails the type-check with TS6059. The check
  // must widen rootDir to the workspace root.
  it('type-checks with rootDir set to the workspace root', async () => {
    const context = {
      root: '/root',
      projectName: 'my-app',
      projectGraph: {
        nodes: { 'my-app': { data: { root: 'apps/my-app' } } },
      },
    } as unknown as ExecutorContext;

    await executeTypeCheck(
      { tsConfig: 'apps/my-app/tsconfig.app.json' } as RspackExecutorSchema,
      context
    );

    expect(runTypeCheck).toHaveBeenCalledWith(
      expect.objectContaining({ rootDir: '/root' })
    );
  });
});
