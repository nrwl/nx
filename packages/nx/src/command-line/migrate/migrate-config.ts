import type { NxMigrateConfiguration } from '../../config/nx-json';
import { AGENT_IDS, coerceAgenticArg } from './agentic/cli-args';
import {
  customCommitPrefixHasNoEffect,
  DEFAULT_MIGRATION_COMMIT_PREFIX,
  MIGRATE_MODES,
  MULTI_MAJOR_MODES,
} from './command-object';

const MULTI_MAJOR_MODE_ENV = 'NX_MULTI_MAJOR_MODE';

/**
 * Overlays `nx.json` `migrate` defaults onto the raw `nx migrate` CLI args so a
 * CLI flag always wins, then `nx.json`, then the built-in default. Returns a new
 * args object; the input is not mutated.
 *
 * Phase-aware: generate-only options (`mode`, `multiMajorMode`) are applied only
 * when not running migrations; run-only options (`createCommits`,
 * `commitPrefix`, `agentic`, `validate`) only when running migrations. This
 * mirrors where each option is consumed and avoids tripping the "cannot be
 * combined with --run-migrations" guards in `parseMigrationsOptions`.
 */
export function applyNxJsonMigrateDefaults(
  args: { [k: string]: any },
  migrateConfig: NxMigrateConfiguration | undefined,
  env: NodeJS.ProcessEnv = process.env
): { [k: string]: any } {
  if (!migrateConfig) {
    return args;
  }

  const merged = { ...args };
  // `--run-migrations` with no value is normalized to '' by yargs, so a defined
  // (even empty-string) value means we're in the run-migrations phase.
  const isRunMigrations = merged.runMigrations !== undefined;

  if (isRunMigrations) {
    if (
      merged.createCommits === undefined &&
      migrateConfig.createCommits !== undefined
    ) {
      merged.createCommits = migrateConfig.createCommits;
    }
    // `commitPrefix` carries a yargs default, so the default value is
    // indistinguishable from "not provided" - treat it as not provided so
    // nx.json can override it.
    if (
      (merged.commitPrefix === undefined ||
        merged.commitPrefix === DEFAULT_MIGRATION_COMMIT_PREFIX) &&
      migrateConfig.commitPrefix !== undefined
    ) {
      merged.commitPrefix = migrateConfig.commitPrefix;
    }
    if (merged.agentic === undefined && migrateConfig.agentic !== undefined) {
      assertValidAgentic(migrateConfig.agentic);
      merged.agentic = coerceAgenticArg(migrateConfig.agentic);
    }
    if (merged.validate === undefined && migrateConfig.validate !== undefined) {
      merged.validate = migrateConfig.validate;
    }
  } else {
    if (merged.mode === undefined && migrateConfig.mode !== undefined) {
      assertOneOf(migrateConfig.mode, MIGRATE_MODES, 'mode');
      merged.mode = migrateConfig.mode;
    }
    // The NX_MULTI_MAJOR_MODE env var is an established per-invocation override,
    // so it takes precedence over nx.json (CLI flag > env > nx.json > default).
    if (
      merged.multiMajorMode === undefined &&
      !env[MULTI_MAJOR_MODE_ENV] &&
      migrateConfig.multiMajorMode !== undefined
    ) {
      assertOneOf(
        migrateConfig.multiMajorMode,
        MULTI_MAJOR_MODES,
        'multiMajorMode'
      );
      merged.multiMajorMode = migrateConfig.multiMajorMode;
    }
  }

  return merged;
}

function assertOneOf(
  value: unknown,
  allowed: readonly string[],
  field: string
): void {
  if (!allowed.includes(value as string)) {
    throw new Error(
      `Error: Invalid nx.json migrate.${field} "${value}". Allowed: ${allowed.join(
        ', '
      )}.`
    );
  }
}

function assertValidAgentic(agentic: unknown): void {
  if (typeof agentic === 'boolean') {
    return;
  }
  if (
    typeof agentic !== 'string' ||
    !(AGENT_IDS as readonly string[]).includes(agentic)
  ) {
    throw new Error(
      `Error: Invalid nx.json migrate.agentic "${agentic}". Allowed: ${AGENT_IDS.join(
        ', '
      )}, true, false.`
    );
  }
}

/**
 * The single authority for the "a custom commit prefix needs commits enabled"
 * invariant. Run it against the final merged args (after
 * `applyNxJsonMigrateDefaults`): the yargs `.check()` only sees the CLI args,
 * but nx.json may enable commits via `createCommits` or `agentic`. The CLI
 * `.check()` only fast-fails the unrescuable explicit `--no-create-commits`
 * case; everything else is decided here.
 */
export function assertCommitPrefixHasCommits(merged: {
  [k: string]: any;
}): void {
  const { createCommits, commitPrefix, agentic } = merged;
  if (customCommitPrefixHasNoEffect({ createCommits, commitPrefix, agentic })) {
    throw new Error(
      'Error: A custom migrate commit prefix requires commits to be enabled. Set `migrate.createCommits` to `true` in nx.json or pass `--create-commits`.'
    );
  }
}
