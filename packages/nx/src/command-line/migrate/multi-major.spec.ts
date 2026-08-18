const resolveMock = jest.fn();
jest.mock('./resolve-package-version', () => ({
  resolvePackageVersionRespectingMinReleaseAge: (...args: unknown[]) =>
    resolveMock(...args),
}));
jest.mock('../../utils/installed-nx-version', () => ({
  getInstalledNxVersion: jest.fn(() => '21.0.0'),
}));
const canPromptMock = jest.fn((..._args: unknown[]) => false);
const migratePromptMock = jest.fn();
jest.mock('./safe-prompt', () => ({
  canPrompt: (...args: unknown[]) => canPromptMock(...args),
  migratePrompt: (...args: unknown[]) => migratePromptMock(...args),
}));
jest.mock('../../utils/output', () => ({
  output: { warn: jest.fn(), log: jest.fn() },
}));
const recordPromptMock = jest.fn();
jest.mock('./migrate-analytics', () => ({
  reportMigratePrompt: (...args: unknown[]) => recordPromptMock(...args),
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

describe('multi-major analytics decision', () => {
  beforeEach(() => {
    resolveMock.mockReset();
    canPromptMock.mockReset();
    canPromptMock.mockReturnValue(false);
    migratePromptMock.mockReset();
    recordPromptMock.mockReset();
  });

  it('returns a direct decision from the --multi-major-mode flag', async () => {
    const result = await maybePromptOrWarnMultiMajorMigration({
      include: 'all',
      options: { multiMajorMode: 'direct' },
      targetPackage: 'nx',
      targetVersion: '23.0.0',
    });
    expect(result.decision).toBe('direct');
  });

  it('returns a gradual decision when an incremental step is available', async () => {
    resolveMock.mockImplementation((_pkg: string, range: string) =>
      Promise.resolve(range === '^21.0.0' ? '21.9.9' : '22.9.9')
    );
    const result = await maybePromptOrWarnMultiMajorMigration({
      include: 'all',
      options: { multiMajorMode: 'gradual' },
      targetPackage: 'nx',
      targetVersion: '23.0.0',
    });
    expect(result.decision).toBe('gradual');
  });

  it('returns a direct decision on the non-interactive warn-only path', async () => {
    const result = await maybePromptOrWarnMultiMajorMigration({
      include: 'all',
      options: {},
      targetPackage: 'nx',
      targetVersion: '23.0.0',
    });
    expect(result.decision).toBe('direct');
  });

  it('returns a direct decision when gradual has no eligible step', async () => {
    // gradual flag set, but the registry probe yields no valid incremental
    // version, so gradual is forced to degrade to direct.
    resolveMock.mockResolvedValue('not-a-version');
    const result = await maybePromptOrWarnMultiMajorMigration({
      include: 'all',
      options: { multiMajorMode: 'gradual' },
      targetPackage: 'nx',
      targetVersion: '23.0.0',
    });
    expect(result.decision).toBe('direct');
  });

  it('leaves the decision unset when the multi-major gate does not apply', async () => {
    const result = await maybePromptOrWarnMultiMajorMigration({
      include: 'all',
      options: {},
      targetPackage: 'nx',
      // 1-major jump: below the multi-major threshold.
      targetVersion: '22.0.0',
    });
    expect(result.decision).toBeUndefined();
  });

  // The interactive prompt returns a concrete version; the mapping collapses it
  // back to the option the user picked (prompt event choice) and to
  // gradual/direct (returned decision). Installed 21, current=21.9.9,
  // next=22.9.9, target=23.0.0.
  it.each([
    { chosen: '23.0.0', prompt: 'direct', choice: 'direct' },
    { chosen: '21.9.9', prompt: 'latest-in-current', choice: 'gradual' },
    { chosen: '22.9.9', prompt: 'latest-in-next', choice: 'gradual' },
  ])(
    'maps interactive choice $chosen to prompt=$prompt / decision=$choice',
    async ({ chosen, prompt, choice }) => {
      canPromptMock.mockReturnValue(true);
      resolveMock.mockImplementation((_pkg: string, range: string) =>
        Promise.resolve(range === '^21.0.0' ? '21.9.9' : '22.9.9')
      );
      migratePromptMock.mockResolvedValue({ chosen });
      const result = await maybePromptOrWarnMultiMajorMigration({
        include: 'all',
        options: { interactive: true },
        targetPackage: 'nx',
        targetVersion: '23.0.0',
      });
      expect(recordPromptMock).toHaveBeenCalledWith('multi_major', prompt);
      expect(result.decision).toBe(choice);
    }
  );
});
