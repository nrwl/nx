const resolveMock = jest.fn();
jest.mock('./resolve-package-version', () => ({
  resolvePackageVersionRespectingMinReleaseAge: (...args: unknown[]) =>
    resolveMock(...args),
}));
jest.mock('../../utils/installed-nx-version', () => ({
  getInstalledNxVersion: jest.fn(() => '21.0.0'),
}));
jest.mock('./safe-prompt', () => ({
  canPrompt: () => false,
  migratePrompt: jest.fn(),
}));
jest.mock('../../utils/output', () => ({
  output: { warn: jest.fn(), log: jest.fn() },
}));

import { MinReleaseAgeViolationError } from '../../utils/min-release-age/errors';
import { maybePromptOrWarnMultiMajorMigration } from './multi-major';

// Installed at 21, target at 23 (a 2-major jump), non-interactive gradual: this
// drives resolveLatestStableInMajor for majors 21 and 22.
const gradualArgs = {
  mode: 'all' as const,
  options: { multiMajorMode: 'gradual' as const },
  targetPackage: 'nx',
  targetVersion: '23.0.0',
};

describe('multi-major minimum-release-age probe', () => {
  beforeEach(() => resolveMock.mockReset());

  it('probes each candidate major side-effect-free (applySideEffects: false)', async () => {
    resolveMock.mockImplementation((_pkg: string, range: string) =>
      Promise.resolve(range === '^21.0.0' ? '21.9.9' : '22.9.9')
    );

    await maybePromptOrWarnMultiMajorMigration(gradualArgs);

    expect(resolveMock).toHaveBeenCalledWith('nx', '^21.0.0', {
      applySideEffects: false,
    });
    expect(resolveMock).toHaveBeenCalledWith('nx', '^22.0.0', {
      applySideEffects: false,
    });
  });

  it('treats an invalid resolved version as no available step', async () => {
    resolveMock.mockResolvedValue('not-a-version');
    const result = await maybePromptOrWarnMultiMajorMigration(gradualArgs);
    expect(result.chosen).toBe('23.0.0');
  });

  it('swallows a cooldown violation thrown by the probe', async () => {
    resolveMock.mockRejectedValue(
      new MinReleaseAgeViolationError({
        packageManager: 'pnpm',
        packageName: 'nx',
        spec: '^21.0.0',
        pmShapedDetail: 'blocked',
        blocked: [],
        remediation: [],
      })
    );
    const result = await maybePromptOrWarnMultiMajorMigration(gradualArgs);
    expect(result.chosen).toBe('23.0.0');
  });
});
