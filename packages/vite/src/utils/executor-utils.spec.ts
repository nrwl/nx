import { validateTypes } from './executor-utils';
import { runTypeCheck } from '@nx/js';

vi.mock('@nx/js', () => ({
  runTypeCheck: vi.fn().mockResolvedValue({ errors: [], warnings: [] }),
  printDiagnostics: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@nx/js/internal', () => ({
  calculateProjectBuildableDependencies: vi.fn(),
  createTmpTsConfig: vi.fn(),
}));

describe('validateTypes', () => {
  afterEach(() => vi.clearAllMocks());

  // TS 6 defaults rootDir to the tsconfig dir, so a workspace lib resolved from
  // source (outside the project) fails the type-check with TS6059. The check
  // must widen rootDir to the workspace root.
  it('type-checks with rootDir set to the workspace root', async () => {
    await validateTypes({
      workspaceRoot: '/root',
      tsconfig: 'apps/my-app/tsconfig.app.json',
    });

    expect(runTypeCheck).toHaveBeenCalledWith(
      expect.objectContaining({ rootDir: '/root' })
    );
  });
});
