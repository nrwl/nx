import {
  applyNxJsonMigrateDefaults,
  assertCommitPrefixHasCommits,
} from './migrate-config';
import { DEFAULT_MIGRATION_COMMIT_PREFIX } from './command-object';
import type { NxMigrateConfiguration } from '../../config/nx-json';

// Empty env so NX_MULTI_MAJOR_MODE never leaks in from the host.
const noEnv: NodeJS.ProcessEnv = {};

describe('applyNxJsonMigrateDefaults', () => {
  it('returns the args unchanged when there is no migrate config', () => {
    const args = { runMigrations: 'migrations.json' };
    expect(applyNxJsonMigrateDefaults(args, undefined, noEnv)).toBe(args);
  });

  it('does not mutate the input args', () => {
    const args = { runMigrations: 'migrations.json' };
    const config: NxMigrateConfiguration = { createCommits: true };
    const result = applyNxJsonMigrateDefaults(args, config, noEnv);
    expect(args).toEqual({ runMigrations: 'migrations.json' });
    expect(result).not.toBe(args);
  });

  describe('run-migrations phase', () => {
    const base = { runMigrations: 'migrations.json' };

    it('fills run-phase options from config when not provided on the CLI', () => {
      const config: NxMigrateConfiguration = {
        createCommits: true,
        commitPrefix: 'chore: migrate ',
        agentic: 'claude-code',
        validate: false,
      };
      const result = applyNxJsonMigrateDefaults(base, config, noEnv);
      expect(result).toMatchObject({
        createCommits: true,
        commitPrefix: 'chore: migrate ',
        agentic: 'claude-code',
        validate: false,
      });
    });

    it('lets the CLI flag win over config', () => {
      const args = {
        ...base,
        createCommits: false,
        agentic: 'codex',
        validate: true,
      };
      const config: NxMigrateConfiguration = {
        createCommits: true,
        agentic: 'claude-code',
        validate: false,
      };
      const result = applyNxJsonMigrateDefaults(args, config, noEnv);
      expect(result.createCommits).toBe(false);
      expect(result.agentic).toBe('codex');
      expect(result.validate).toBe(true);
    });

    it('treats the default commit prefix as "not provided" so config can override it', () => {
      const args = {
        ...base,
        createCommits: true,
        commitPrefix: DEFAULT_MIGRATION_COMMIT_PREFIX,
      };
      const config: NxMigrateConfiguration = {
        commitPrefix: 'chore: migrate ',
      };
      const result = applyNxJsonMigrateDefaults(args, config, noEnv);
      expect(result.commitPrefix).toBe('chore: migrate ');
    });

    it('keeps a custom CLI commit prefix over config', () => {
      const args = {
        ...base,
        createCommits: true,
        commitPrefix: 'cli prefix ',
      };
      const config: NxMigrateConfiguration = { commitPrefix: 'config prefix ' };
      const result = applyNxJsonMigrateDefaults(args, config, noEnv);
      expect(result.commitPrefix).toBe('cli prefix ');
    });

    it('coerces config agentic booleans', () => {
      expect(
        applyNxJsonMigrateDefaults(base, { agentic: true }, noEnv).agentic
      ).toBe(true);
      expect(
        applyNxJsonMigrateDefaults(base, { agentic: false }, noEnv).agentic
      ).toBe(false);
    });

    it('does not apply generate-only options in run-migrations mode', () => {
      const config: NxMigrateConfiguration = {
        include: 'required',
        multiMajorMode: 'gradual',
      };
      const result = applyNxJsonMigrateDefaults(base, config, noEnv);
      expect(result.include).toBeUndefined();
      expect(result.multiMajorMode).toBeUndefined();
    });

    it('detects run-migrations mode even when the value is an empty string', () => {
      const config: NxMigrateConfiguration = {
        createCommits: true,
        include: 'required',
      };
      const result = applyNxJsonMigrateDefaults(
        { runMigrations: '' },
        config,
        noEnv
      );
      expect(result.createCommits).toBe(true);
      expect(result.include).toBeUndefined();
    });

    it('errors when a config commit prefix is set without commits enabled', () => {
      const config: NxMigrateConfiguration = {
        commitPrefix: 'chore: migrate ',
      };
      const merged = applyNxJsonMigrateDefaults(base, config, noEnv);
      expect(() => assertCommitPrefixHasCommits(merged)).toThrow(
        /requires commits to be enabled/i
      );
    });

    it('allows a config commit prefix when createCommits is enabled via config', () => {
      const config: NxMigrateConfiguration = {
        commitPrefix: 'chore: migrate ',
        createCommits: true,
      };
      const merged = applyNxJsonMigrateDefaults(base, config, noEnv);
      expect(() => assertCommitPrefixHasCommits(merged)).not.toThrow();
    });

    it('allows a config commit prefix when createCommits is enabled via the CLI', () => {
      const config: NxMigrateConfiguration = {
        commitPrefix: 'chore: migrate ',
      };
      const merged = applyNxJsonMigrateDefaults(
        { ...base, createCommits: true },
        config,
        noEnv
      );
      expect(merged.commitPrefix).toBe('chore: migrate ');
      expect(() => assertCommitPrefixHasCommits(merged)).not.toThrow();
    });

    it('allows a config commit prefix when the agentic flow may enable commits', () => {
      const config: NxMigrateConfiguration = {
        commitPrefix: 'chore: migrate ',
        agentic: 'claude-code',
      };
      const merged = applyNxJsonMigrateDefaults(base, config, noEnv);
      expect(() => assertCommitPrefixHasCommits(merged)).not.toThrow();
    });

    it('allows a custom CLI commit prefix when commits are enabled via config', () => {
      const config: NxMigrateConfiguration = { createCommits: true };
      const merged = applyNxJsonMigrateDefaults(
        { ...base, commitPrefix: 'cli prefix ' },
        config,
        noEnv
      );
      expect(merged.commitPrefix).toBe('cli prefix ');
      expect(() => assertCommitPrefixHasCommits(merged)).not.toThrow();
    });

    it('allows a custom CLI commit prefix when agentic is enabled via config', () => {
      const config: NxMigrateConfiguration = { agentic: 'claude-code' };
      const merged = applyNxJsonMigrateDefaults(
        { ...base, commitPrefix: 'cli prefix ' },
        config,
        noEnv
      );
      expect(() => assertCommitPrefixHasCommits(merged)).not.toThrow();
    });

    it('errors on a custom CLI commit prefix when there is no migrate config', () => {
      const merged = applyNxJsonMigrateDefaults(
        { ...base, commitPrefix: 'cli prefix ' },
        undefined,
        noEnv
      );
      expect(() => assertCommitPrefixHasCommits(merged)).toThrow(
        /requires commits to be enabled/i
      );
    });

    it('errors on an invalid config agentic value', () => {
      const config = {
        agentic: 'not-an-agent',
      } as unknown as NxMigrateConfiguration;
      expect(() => applyNxJsonMigrateDefaults(base, config, noEnv)).toThrow(
        /Invalid nx\.json migrate\.agentic/i
      );
    });

    it('errors on a non-boolean config createCommits', () => {
      const config = {
        createCommits: 'false',
      } as unknown as NxMigrateConfiguration;
      expect(() => applyNxJsonMigrateDefaults(base, config, noEnv)).toThrow(
        /Invalid nx\.json migrate\.createCommits .*Expected a boolean/i
      );
    });

    it('errors on a non-string config commitPrefix', () => {
      const config = {
        createCommits: true,
        commitPrefix: 123,
      } as unknown as NxMigrateConfiguration;
      expect(() => applyNxJsonMigrateDefaults(base, config, noEnv)).toThrow(
        /Invalid nx\.json migrate\.commitPrefix .*Expected a string/i
      );
    });

    it('errors on a non-boolean config validate', () => {
      const config = {
        validate: 'true',
      } as unknown as NxMigrateConfiguration;
      expect(() => applyNxJsonMigrateDefaults(base, config, noEnv)).toThrow(
        /Invalid nx\.json migrate\.validate .*Expected a boolean/i
      );
    });
  });

  describe('single-migration phase', () => {
    const base = { runMigration: '@nx/js:some-migration' };

    it('fills the commit options from config but not run-loop or generate-only options', () => {
      const config: NxMigrateConfiguration = {
        createCommits: true,
        commitPrefix: 'chore: migrate ',
        agentic: 'claude-code',
        validate: false,
        include: 'required',
        multiMajorMode: 'gradual',
      };
      const result = applyNxJsonMigrateDefaults(base, config, noEnv);
      expect(result.createCommits).toBe(true);
      expect(result.commitPrefix).toBe('chore: migrate ');
      expect(result.agentic).toBeUndefined();
      expect(result.validate).toBeUndefined();
      expect(result.include).toBeUndefined();
      expect(result.includeFromConfig).toBeUndefined();
      expect(result.multiMajorMode).toBeUndefined();
    });

    it('lets the CLI commit flags win over config', () => {
      const args = {
        ...base,
        createCommits: false,
        commitPrefix: 'cli prefix ',
      };
      const config: NxMigrateConfiguration = {
        createCommits: true,
        commitPrefix: 'config prefix ',
      };
      const result = applyNxJsonMigrateDefaults(args, config, noEnv);
      expect(result.createCommits).toBe(false);
      expect(result.commitPrefix).toBe('cli prefix ');
    });
  });

  describe('generate-migrations phase', () => {
    const base = { packageAndVersion: 'nx@latest' };

    it('carries config mode as includeFromConfig (not mode) and fills other generate-only options', () => {
      const config: NxMigrateConfiguration = {
        include: 'required',
        multiMajorMode: 'gradual',
      };
      const result = applyNxJsonMigrateDefaults(base, config, noEnv);
      // Carried separately so it is never treated as an explicit `--include`,
      // which would hard-fail `nx migrate <non-nx-pkg>`.
      expect(result.include).toBeUndefined();
      expect(result.includeFromConfig).toBe('required');
      expect(result.multiMajorMode).toBe('gradual');
    });

    it('does not apply run-only options in generate-migrations mode', () => {
      const config: NxMigrateConfiguration = {
        createCommits: true,
        commitPrefix: 'chore: migrate ',
        agentic: 'claude-code',
        validate: false,
      };
      const result = applyNxJsonMigrateDefaults(base, config, noEnv);
      expect(result.createCommits).toBeUndefined();
      expect(result.commitPrefix).toBeUndefined();
      expect(result.agentic).toBeUndefined();
      expect(result.validate).toBeUndefined();
    });

    it('lets the CLI flag win over config', () => {
      const args = { ...base, include: 'all', multiMajorMode: 'direct' };
      const config: NxMigrateConfiguration = {
        include: 'required',
        multiMajorMode: 'gradual',
      };
      const result = applyNxJsonMigrateDefaults(args, config, noEnv);
      expect(result.include).toBe('all');
      expect(result.includeFromConfig).toBeUndefined();
      expect(result.multiMajorMode).toBe('direct');
    });

    it('lets NX_MULTI_MAJOR_MODE take precedence over config', () => {
      const config: NxMigrateConfiguration = { multiMajorMode: 'gradual' };
      const result = applyNxJsonMigrateDefaults(base, config, {
        NX_MULTI_MAJOR_MODE: 'direct',
      });
      // Not applied from config; the env var is resolved later by the migrator.
      expect(result.multiMajorMode).toBeUndefined();
    });

    it('errors on an invalid config mode value', () => {
      const config = { include: 'bogus' } as unknown as NxMigrateConfiguration;
      expect(() => applyNxJsonMigrateDefaults(base, config, noEnv)).toThrow(
        /Invalid nx\.json migrate\.include/i
      );
    });

    it('errors on an invalid config multiMajorMode value', () => {
      const config = {
        multiMajorMode: 'bogus',
      } as unknown as NxMigrateConfiguration;
      expect(() => applyNxJsonMigrateDefaults(base, config, noEnv)).toThrow(
        /Invalid nx\.json migrate\.multiMajorMode/i
      );
    });
  });
});
