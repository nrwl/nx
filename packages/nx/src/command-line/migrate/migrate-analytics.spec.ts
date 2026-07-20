import { ProvenanceError } from '../../utils/provenance';
import {
  classifyMigrateFetchFallback,
  computeMajorsCrossed,
  type MigrateGenerateErrorCode,
  type MigratePromptName,
  type MigrateRunErrorCode,
} from './migrate-analytics';

describe('computeMajorsCrossed', () => {
  it('should compute the number of majors between installed and target', () => {
    expect(computeMajorsCrossed('21.0.0', '23.1.0')).toBe(2);
    expect(computeMajorsCrossed('22.1.0', '23.0.0')).toBe(1);
    expect(computeMajorsCrossed('23.0.0', '23.5.0')).toBe(0);
  });

  it('should tolerate ranges and partial versions', () => {
    expect(computeMajorsCrossed('^21.0.0', '23.0.0')).toBe(2);
    expect(computeMajorsCrossed('~22.1.0', '23.0.0')).toBe(1);
    expect(computeMajorsCrossed('21', '23.0.0')).toBe(2);
  });

  it('should clamp downgrades to 0', () => {
    expect(computeMajorsCrossed('23.0.0', '21.0.0')).toBe(0);
  });

  it('should return undefined when either version is unknown', () => {
    expect(computeMajorsCrossed(null, '23.0.0')).toBeUndefined();
    expect(computeMajorsCrossed(undefined, '23.0.0')).toBeUndefined();
    expect(computeMajorsCrossed('21.0.0', null)).toBeUndefined();
    expect(computeMajorsCrossed('latest', '23.0.0')).toBeUndefined();
  });
});

describe('classifyMigrateFetchFallback', () => {
  it('should classify provenance errors', () => {
    // Avoid the constructor - it shells out to detect the registry.
    const error = Object.create(ProvenanceError.prototype) as ProvenanceError;
    expect(classifyMigrateFetchFallback(error)).toBe('provenance');
  });

  it('should classify unsupported registry errors', () => {
    expect(
      classifyMigrateFetchFallback(
        new Error(
          'Getting migration config from registry is not supported from my.registry.example.com'
        )
      )
    ).toBe('unsupported-registry');
  });

  it('should classify everything else as a registry error', () => {
    expect(classifyMigrateFetchFallback(new Error('ETIMEDOUT'))).toBe(
      'registry-error'
    );
    expect(classifyMigrateFetchFallback('boom')).toBe('registry-error');
  });
});

// GA4 caps event names at 40 chars and the Rust sender silently truncates
// past it (service.rs), so every name built from the prompt-name and
// error-code unions must fit. `Record<union, true>` makes these lists fail
// to compile when a member is added or renamed, keeping the check exhaustive.
describe('GA4 event name length cap', () => {
  const PROMPT_NAMES: Record<MigratePromptName, true> = {
    include: true,
    multi_major: true,
    agentic: true,
    agent_select: true,
    ambiguous_agent_outcome: true,
  };
  const GENERATE_ERROR_CODES: Record<MigrateGenerateErrorCode, true> = {
    resolve_version: true,
    fetch_migrations: true,
    package_updates: true,
  };
  const RUN_ERROR_CODES: Record<MigrateRunErrorCode, true> = {
    npm_install: true,
    migration_exec: true,
    agentic: true,
    other: true,
  };

  it('keeps every event name within 40 characters', () => {
    const names = [
      'migrate_generate_start',
      'migrate_generate_complete',
      'migrate_run_start',
      'migrate_run_complete',
      'migrate_orchestrator_init',
      'migrate_orchestrator_dispense',
      'migrate_orchestrator_complete',
      'migrate_single_migration_recorded',
      'migrate_single_migration_standalone',
      ...Object.keys(PROMPT_NAMES).map((p) => `migrate_prompt_${p}`),
      ...Object.keys(GENERATE_ERROR_CODES).map(
        (c) => `migrate_generate_error_${c}`
      ),
      ...Object.keys(RUN_ERROR_CODES).map((c) => `migrate_run_error_${c}`),
    ];
    const tooLong = names.filter((name) => name.length > 40);
    expect(tooLong).toEqual([]);
  });
});

// The event recorders read module state and emit through `../../analytics`.
// Mock the bridge so `reportEvent` is observable, and key params by the bare
// dimension name (the Proxy returns the accessed key) so assertions don't
// depend on the native-generated GA strings. `customDimensions` is `null` in
// the WASM build, which the no-op guard relies on. Module-level state persists
// across calls, so each test loads a fresh module instance.
let mockCustomDimensions: unknown;
let mockReportEvent: jest.Mock;

jest.mock('../../analytics', () => ({
  get customDimensions() {
    return mockCustomDimensions;
  },
  reportEvent: (...args: unknown[]) => mockReportEvent(...args),
}));

describe('migrate-analytics events', () => {
  function load() {
    jest.resetModules();
    return require('./migrate-analytics') as typeof import('./migrate-analytics');
  }

  // Params for the first emitted event of the given name.
  function paramsFor(name: string): Record<string, unknown> | undefined {
    const call = mockReportEvent.mock.calls.find((c) => c[0] === name);
    return call?.[1];
  }

  function countOf(name: string): number {
    return mockReportEvent.mock.calls.filter((c) => c[0] === name).length;
  }

  beforeEach(() => {
    mockReportEvent = jest.fn();
    mockCustomDimensions = new Proxy({}, { get: (_t, key) => key });
  });

  describe('WASM no-op guard', () => {
    it('emits nothing when customDimensions is null', () => {
      mockCustomDimensions = null;
      const a = load();
      a.reportMigrateGenerateStart({ targetPackage: 'nx' });
      a.reportMigratePrompt('include', 'all');
      a.reportMigrateGenerateComplete({
        targetVersion: '23.0.0',
        requestedTargetVersion: '23.0.0',
        installedTargetVersion: '22.0.0',
        include: 'all',
      });
      a.reportMigrateRunStart({ createCommits: true, migrationCount: 3 });
      a.reportMigrateRunComplete({
        agenticOutcome: 'disabled',
        migrationCount: 3,
        appliedCount: 3,
      });
      a.reportMigrateGenerateError('fetch_migrations', new Error('x'));
      a.reportMigrateRunError({ code: 'other', error: new Error('x') });
      expect(mockReportEvent).not.toHaveBeenCalled();
    });
  });

  describe('reportMigratePrompt', () => {
    it('encodes the prompt name in the event name and emits the choice', () => {
      const a = load();
      a.reportMigratePrompt('multi_major', 'latest-in-current');
      expect(paramsFor('migrate_prompt_multi_major')).toEqual({
        promptChoice: 'latest-in-current',
      });
    });
  });

  describe('reportMigrateGenerateStart', () => {
    it('emits the target package and flags', () => {
      const a = load();
      a.reportMigrateGenerateStart({
        targetPackage: '@nx/workspace',
        interactive: false,
        excludeAppliedMigrations: true,
      });
      expect(paramsFor('migrate_generate_start')).toMatchObject({
        packageName: '@nx/workspace',
        interactive: false,
        excludeAppliedMigrations: true,
      });
    });
  });

  describe('reportMigrateGenerateComplete', () => {
    it('reports the resolved include and its source', () => {
      const a = load();
      a.setMigrateIncludeSource('nx-json');
      a.reportMigrateGenerateComplete({
        targetVersion: '23.1.0',
        requestedTargetVersion: '23.1.0',
        installedTargetVersion: '23.0.0',
        include: 'required',
      });
      expect(paramsFor('migrate_generate_complete')).toMatchObject({
        packageVersion: '23.1.0',
        include: 'required',
        includeSource: 'nx-json',
      });
    });

    it.each([
      { stats: { registryCount: 2, installCount: 0 }, expected: 'registry' },
      { stats: { registryCount: 0, installCount: 1 }, expected: 'install' },
      { stats: { registryCount: 1, installCount: 1 }, expected: 'mixed' },
      { stats: { registryCount: 0, installCount: 0 }, expected: undefined },
      { stats: undefined, expected: undefined },
    ])('derives fetch_method=$expected from $stats', ({ stats, expected }) => {
      const a = load();
      a.reportMigrateGenerateComplete({
        targetVersion: '22.1.0',
        requestedTargetVersion: '22.1.0',
        installedTargetVersion: '22.0.0',
        include: 'all',
        fetchStats: stats,
      });
      expect(paramsFor('migrate_generate_complete')?.fetchMethod).toBe(
        expected
      );
    });

    it('passes through the first fetch fallback reason', () => {
      const a = load();
      a.reportMigrateGenerateComplete({
        targetVersion: '22.1.0',
        requestedTargetVersion: '22.1.0',
        installedTargetVersion: '22.0.0',
        include: 'all',
        fetchStats: {
          registryCount: 3,
          installCount: 1,
          fallbackReason: 'provenance',
        },
      });
      expect(paramsFor('migrate_generate_complete')).toMatchObject({
        fetchMethod: 'mixed',
        fetchFallbackReason: 'provenance',
      });
    });

    it('includes the multi-major choice only when 2+ majors are crossed', () => {
      const a = load();
      a.reportMigrateGenerateComplete({
        targetVersion: '23.0.0',
        requestedTargetVersion: '23.0.0',
        installedTargetVersion: '21.0.0',
        include: 'all',
        multiMajorChoice: 'gradual',
      });
      expect(paramsFor('migrate_generate_complete')).toMatchObject({
        multiMajorChoice: 'gradual',
      });
    });

    it('omits the multi-major choice when fewer than 2 majors are crossed', () => {
      const a = load();
      a.reportMigrateGenerateComplete({
        targetVersion: '23.0.0',
        requestedTargetVersion: '23.0.0',
        installedTargetVersion: '22.0.0',
        include: 'all',
        multiMajorChoice: 'gradual',
      });
      const params = paramsFor('migrate_generate_complete');
      expect(params).not.toHaveProperty('multiMajorChoice');
    });
  });

  describe('reportMigrateGenerateError', () => {
    it('encodes the phase in the event name, records once, and folds in include context plus the error name', () => {
      const a = load();
      a.setMigrateInclude('optional');
      a.setMigrateIncludeSource('flag');
      a.reportMigrateGenerateError('package_updates', new TypeError('boom'));
      a.reportMigrateGenerateError('fetch_migrations', new Error('second'));
      expect(countOf('migrate_generate_error_package_updates')).toBe(1);
      expect(countOf('migrate_generate_error_fetch_migrations')).toBe(0);
      expect(paramsFor('migrate_generate_error_package_updates')).toMatchObject(
        {
          include: 'optional',
          includeSource: 'flag',
          errorName: 'TypeError',
        }
      );
    });

    it('prefers a Node system code over the constructor name', () => {
      const a = load();
      const err = Object.assign(new Error('no file'), { code: 'ENOENT' });
      a.reportMigrateGenerateError('fetch_migrations', err);
      expect(
        paramsFor('migrate_generate_error_fetch_migrations')?.errorName
      ).toBe('ENOENT');
    });

    it('rejects a non-identifier code (path/message) and falls back to the name', () => {
      const a = load();
      const err = Object.assign(new TypeError('x'), {
        code: '/Users/alice/secret-project',
      });
      a.reportMigrateGenerateError('fetch_migrations', err);
      // The path-shaped `.code` would leak; it is dropped for the name.
      expect(
        paramsFor('migrate_generate_error_fetch_migrations')?.errorName
      ).toBe('TypeError');
    });

    it('extracts a package-qualified nx location from the stack', () => {
      const a = load();
      const err = new Error('x');
      err.stack =
        'Error: x\n    at fn (/Users/me/proj/node_modules/nx/dist/src/command-line/migrate/migrate.js:1830:18)';
      a.reportMigrateGenerateError('package_updates', err);
      expect(
        paramsFor('migrate_generate_error_package_updates')?.errorLocation
      ).toBe('nx/src/command-line/migrate/migrate.js:1830:18');
    });

    it('captures first-party @nx/* frames too', () => {
      const a = load();
      const err = new Error('x');
      err.stack =
        'Error: x\n    at fn (/Users/me/proj/node_modules/@nx/devkit/dist/src/generators/run.js:5:1)';
      a.reportMigrateGenerateError('package_updates', err);
      expect(
        paramsFor('migrate_generate_error_package_updates')?.errorLocation
      ).toBe('@nx/devkit/src/generators/run.js:5:1');
    });

    it('normalizes Windows backslash stack paths', () => {
      const a = load();
      const err = new Error('x');
      err.stack =
        'Error: x\r\n    at fn (C:\\proj\\node_modules\\nx\\dist\\src\\command-line\\migrate\\migrate.js:1830:18)';
      a.reportMigrateGenerateError('package_updates', err);
      expect(
        paramsFor('migrate_generate_error_package_updates')?.errorLocation
      ).toBe('nx/src/command-line/migrate/migrate.js:1830:18');
    });

    it('omits the location for non-first-party (third-party migration) frames', () => {
      const a = load();
      const err = new Error('x');
      err.stack =
        'Error: x\n    at fn (/Users/me/proj/node_modules/@acme/plugin/migrations/x.js:5:1)';
      a.reportMigrateGenerateError('package_updates', err);
      expect(
        paramsFor('migrate_generate_error_package_updates')?.errorLocation
      ).toBeUndefined();
    });
  });

  describe('run lifecycle', () => {
    it('tracks whether a migrate run started and reports the migration count', () => {
      const a = load();
      expect(a.hasMigrateRunStarted()).toBe(false);
      a.reportMigrateRunStart({ createCommits: true, migrationCount: 5 });
      expect(a.hasMigrateRunStarted()).toBe(true);
      expect(paramsFor('migrate_run_start')).toEqual({
        createCommits: true,
        migrationCount: 5,
      });
    });

    it('reports the agentic outcome, agent, and applied tally on completion', () => {
      const a = load();
      a.reportMigrateRunComplete({
        agenticOutcome: 'enabled',
        agentUsed: 'claude',
        migrationCount: 5,
        appliedCount: 4,
      });
      expect(paramsFor('migrate_run_complete')).toEqual({
        agenticOutcome: 'enabled',
        agentUsed: 'claude',
        migrationCount: 5,
        appliedCount: 4,
      });
    });
  });

  describe('reportMigrateRunError', () => {
    it('encodes the step in the event name and records once with the error name', () => {
      const a = load();
      a.reportMigrateRunError({
        code: 'migration_exec',
        error: new Error('a'),
      });
      a.reportMigrateRunError({ code: 'other', error: new Error('b') });
      expect(countOf('migrate_run_error_migration_exec')).toBe(1);
      expect(countOf('migrate_run_error_other')).toBe(0);
      expect(paramsFor('migrate_run_error_migration_exec')).toMatchObject({
        errorName: 'Error',
      });
    });

    it('reports the run size when provided', () => {
      const a = load();
      a.reportMigrateRunError({
        code: 'migration_exec',
        migrationCount: 12,
        error: new Error('boom'),
      });
      expect(paramsFor('migrate_run_error_migration_exec')).toMatchObject({
        migrationCount: 12,
      });
    });

    it('omits the run size at non-loop error sites', () => {
      const a = load();
      a.reportMigrateRunError({ code: 'npm_install', error: new Error('x') });
      const params = paramsFor('migrate_run_error_npm_install');
      expect(params?.migrationCount).toBeUndefined();
    });

    it('reports the migration name only for first-party packages', () => {
      const a = load();
      a.reportMigrateRunError({
        code: 'migration_exec',
        migrationPackage: '@nx/js',
        migrationName: 'update-foo',
      });
      expect(paramsFor('migrate_run_error_migration_exec')).toMatchObject({
        migrationName: '@nx/js:update-foo',
      });
    });

    it('omits the migration name for third-party packages', () => {
      const a = load();
      a.reportMigrateRunError({
        code: 'migration_exec',
        migrationPackage: 'some-third-party',
        migrationName: 'update-foo',
      });
      expect(paramsFor('migrate_run_error_migration_exec')).not.toHaveProperty(
        'migrationName'
      );
    });
  });

  describe('orchestrator events', () => {
    it('reports the migration count and commit flag on init', () => {
      const a = load();
      a.reportMigrateOrchestratorInit({
        migrationCount: 4,
        createCommits: true,
      });
      expect(paramsFor('migrate_orchestrator_init')).toEqual({
        createCommits: true,
        migrationCount: 4,
      });
    });

    it('reports the dispense action, step kind and attempt', () => {
      const a = load();
      a.reportMigrateOrchestratorDispense({
        action: 'next-step',
        stepKind: 'migration',
        attempt: 2,
      });
      expect(paramsFor('migrate_orchestrator_dispense')).toEqual({
        promptChoice: 'next-step',
        migrationName: 'migration',
        migrationCount: 2,
      });
    });

    it('reports the terminal tallies and total dispense count on complete', () => {
      const a = load();
      a.reportMigrateOrchestratorComplete({
        completed: 3,
        skipped: 1,
        dispenseCount: 9,
      });
      expect(paramsFor('migrate_orchestrator_complete')).toEqual({
        appliedCount: 3,
        taskCount: 1,
        migrationCount: 9,
      });
    });

    it('encodes recorded vs standalone in the single-migration event name', () => {
      const a = load();
      a.reportMigrateSingleMigrationInvocation({
        migrationType: 'hybrid',
        orchestrated: true,
      });
      a.reportMigrateSingleMigrationInvocation({
        migrationType: 'prompt',
        orchestrated: false,
      });
      expect(paramsFor('migrate_single_migration_recorded')).toEqual({
        promptChoice: 'hybrid',
      });
      expect(paramsFor('migrate_single_migration_standalone')).toEqual({
        promptChoice: 'prompt',
      });
    });
  });
});
