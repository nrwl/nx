import type { NxMigrateConfiguration } from '../../config/nx-json';
import { AGENT_IDS, coerceAgenticArg } from './agentic/cli-args';
import { DEFAULT_MIGRATION_COMMIT_PREFIX } from './command-object';

const MULTI_MAJOR_MODE_ENV = 'NX_MULTI_MAJOR_MODE';
const VALID_MODES = ['first-party', 'third-party', 'all'];
const VALID_MULTI_MAJOR_MODES = ['direct', 'gradual'];

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
    // indistinguishable from "not provided" — treat it as not provided so
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

    assertCommitPrefixHasCommits(merged);
  } else {
    if (merged.mode === undefined && migrateConfig.mode !== undefined) {
      assertValidMode(migrateConfig.mode);
      merged.mode = migrateConfig.mode;
    }
    // The NX_MULTI_MAJOR_MODE env var is an established per-invocation override,
    // so it takes precedence over nx.json (CLI flag > env > nx.json > default).
    if (
      merged.multiMajorMode === undefined &&
      !env[MULTI_MAJOR_MODE_ENV] &&
      migrateConfig.multiMajorMode !== undefined
    ) {
      assertValidMultiMajorMode(migrateConfig.multiMajorMode);
      merged.multiMajorMode = migrateConfig.multiMajorMode;
    }
  }

  return merged;
}

function assertValidMode(mode: unknown): void {
  if (!VALID_MODES.includes(mode as string)) {
    throw new Error(
      `Error: Invalid nx.json migrate.mode "${mode}". Allowed: ${VALID_MODES.join(
        ', '
      )}.`
    );
  }
}

function assertValidMultiMajorMode(multiMajorMode: unknown): void {
  if (!VALID_MULTI_MAJOR_MODES.includes(multiMajorMode as string)) {
    throw new Error(
      `Error: Invalid nx.json migrate.multiMajorMode "${multiMajorMode}". Allowed: ${VALID_MULTI_MAJOR_MODES.join(
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

// Mirrors the yargs `.check()` guard: a custom commit prefix has no effect
// unless commits are enabled. Re-checked here because the yargs guard only saw
// the CLI args, before nx.json defaults were merged in. The
// `commitPrefix !== DEFAULT` test doubles as the "was it customized" sentinel,
// matching how the prefix is overlaid above.
function assertCommitPrefixHasCommits(merged: { [k: string]: any }): void {
  const { createCommits, commitPrefix, agentic } = merged;
  const agenticMayEnableCommits =
    agentic !== undefined && agentic !== false && createCommits !== false;
  if (
    createCommits !== true &&
    !agenticMayEnableCommits &&
    commitPrefix !== undefined &&
    commitPrefix !== DEFAULT_MIGRATION_COMMIT_PREFIX
  ) {
    throw new Error(
      'Error: A custom migrate commit prefix requires commits to be enabled. Set `migrate.createCommits` to `true` in nx.json or pass `--create-commits`.'
    );
  }
}
