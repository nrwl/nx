import { Argv, CommandModule } from 'yargs';
import { handleImport } from '../../utils/handle-import';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { withVerbose } from '../yargs-utils/shared-options';
import { AGENT_IDS, coerceAgenticArg } from './agentic/cli-args';
import type { AgenticArg } from './agentic/select';

export const yargsMigrateCommand: CommandModule = {
  command: 'migrate [packageAndVersion]',
  describe: `Creates a migrations file or runs migrations from the migrations file.
  - Migrate packages and create migrations.json (e.g., nx migrate @nx/workspace@latest)
  - Run migrations (e.g., nx migrate --run-migrations=migrations.json). Use flag --if-exists to run migrations only if the migrations file exists.`,
  builder: (yargs) =>
    linkToNxDevAndExamples(withMigrationOptions(yargs), 'migrate'),
  handler: async () =>
    process.exit(
      await (await handleImport('./migrate.js', __dirname)).runMigration()
    ),
};

export const yargsInternalMigrateCommand: CommandModule = {
  command: '_migrate [packageAndVersion]',
  describe: false,
  builder: (yargs) => withMigrationOptions(yargs),
  handler: async (args) =>
    process.exit(
      await (
        await handleImport('./migrate.js', __dirname)
      ).migrate(process.cwd(), args, process.argv.slice(3))
    ),
};

export const DEFAULT_MIGRATION_COMMIT_PREFIX = 'chore: [nx migration] ';

/** Allowed values for `--mode` / `migrate.mode`. */
export const MIGRATE_MODES = ['first-party', 'third-party', 'all'] as const;
export type MigrateMode = (typeof MIGRATE_MODES)[number];

/** Allowed values for `--multi-major-mode` / `migrate.multiMajorMode`. */
export const MULTI_MAJOR_MODES = ['direct', 'gradual'] as const;
export type MultiMajorMode = (typeof MULTI_MAJOR_MODES)[number];

/**
 * The `nx migrate` args bag. Types the keys the nx.json overlay and the
 * commit-prefix invariant read/write; the index signature keeps the rest of
 * the yargs args flowing through untouched.
 */
export interface MigrateArgs {
  packageAndVersion?: string;
  runMigrations?: string;
  mode?: MigrateMode;
  /**
   * nx.json `migrate.mode` default. Consumed by `resolveMode` only when the
   * resolved target supports modes; kept separate from `mode` so it is never
   * mistaken for an explicit `--mode` (which hard-fails when the target does
   * not support modes).
   */
  modeFromConfig?: MigrateMode;
  multiMajorMode?: MultiMajorMode;
  createCommits?: boolean;
  commitPrefix?: string;
  agentic?: AgenticArg;
  validate?: boolean;
  // The rest of the yargs args bag flows through untyped.
  [key: string]: any;
}

/**
 * Whether a custom commit prefix would be silently ignored: commits aren't
 * enabled and the agentic flow can't enable them either. Shared by the yargs
 * `.check()` (CLI args) and the nx.json overlay (merged args) so the rule lives
 * in one place. `agentic` may flip commits on by default, so a configured
 * agentic value (other than `false`, and not paired with `--no-create-commits`)
 * keeps the prefix in play.
 */
export function customCommitPrefixHasNoEffect(args: {
  createCommits: boolean | undefined;
  commitPrefix: string | undefined;
  agentic: unknown;
}): boolean {
  const agenticMayEnableCommits =
    args.agentic !== undefined &&
    args.agentic !== false &&
    args.createCommits !== false;
  return (
    args.createCommits !== true &&
    !agenticMayEnableCommits &&
    args.commitPrefix !== undefined &&
    args.commitPrefix !== DEFAULT_MIGRATION_COMMIT_PREFIX
  );
}

function withMigrationOptions(yargs: Argv) {
  return withVerbose(yargs)
    .positional('packageAndVersion', {
      describe: `The target package and version (e.g, @nx/workspace@16.0.0).`,
      type: 'string',
    })
    .option('runMigrations', {
      describe: `Execute migrations from a file (when the file isn't provided, execute migrations from migrations.json).`,
      type: 'string',
    })
    .option('ifExists', {
      describe: `Run migrations only if the migrations file exists, if not continues successfully.`,
      type: 'boolean',
      default: false,
    })
    .option('from', {
      describe:
        'Use the provided versions for packages instead of the ones installed in node_modules (e.g., --from="@nx/react@16.0.0,@nx/js@16.0.0").',
      type: 'string',
    })
    .option('to', {
      describe:
        'Use the provided versions for packages instead of the ones calculated by the migrator (e.g., --to="@nx/react@16.0.0,@nx/js@16.0.0").',
      type: 'string',
    })
    .option('createCommits', {
      describe: 'Automatically create a git commit after each migration runs.',
      type: 'boolean',
      alias: ['C'],
    })
    .option('commitPrefix', {
      describe:
        'Commit prefix to apply to the commit for each migration, when --create-commits is enabled.',
      type: 'string',
      default: DEFAULT_MIGRATION_COMMIT_PREFIX,
    })
    .option('interactive', {
      describe:
        "Enable confirmation prompts for collecting optional package updates and migrations. Deprecated and slated for removal in Nx v24 - use '--mode' instead. The flag stays valid for other interactive prompts.",
      type: 'boolean',
    })
    .option('excludeAppliedMigrations', {
      describe:
        'Exclude migrations that should have been applied on previous updates. To be used with --from.',
      type: 'boolean',
      default: false,
    })
    .option('skipInstall', {
      describe:
        'Skip installing packages before running migrations. Useful when the installation needs to be performed manually (e.g., to resolve peer dependency conflicts).',
      type: 'boolean',
      default: false,
    })
    .option('mode', {
      describe:
        "Restrict which packages to migrate. Only applies when the target package supports migration modes. 'first-party' processes only the target package and the related first-party packages it ships with; 'third-party' processes only the third-party dependencies those packages manage, catching up on any updates that may have been skipped previously; 'all' processes everything. When the target supports modes in an interactive terminal, prompts for the value if not provided; otherwise defaults to 'all'.",
      type: 'string',
      choices: MIGRATE_MODES,
    })
    .option('multiMajorMode', {
      describe:
        "Skip the multi-major migration prompt/warning and pick how to handle the jump. 'direct' migrates straight to the requested target. 'gradual' migrates to the smallest recommended step (re-run `nx migrate` to continue toward the original target). Equivalent env var: NX_MULTI_MAJOR_MODE=direct|gradual.",
      type: 'string',
      choices: MULTI_MAJOR_MODES,
    })
    .option('agentic', {
      describe:
        'Enable the agentic flow for prompt-based migrations and AI-driven review. Pass `--agentic=<agent>` to pin a specific agent (claude-code, codex, or opencode). Pass `--agentic=false` or `--no-agentic` to disable.',
      coerce: coerceAgenticArg,
    })
    .option('validate', {
      describe:
        'When `--agentic` resolves to an enabled agent, run agent-driven validation after generator-only migrations that have no `prompt:` field. Defaults to on; pass `--no-validate` to opt out. Has no effect when `--agentic` is disabled, when running inside an outer agent, or when running non-interactively without an explicit agent.',
      type: 'boolean',
    })
    .check(
      ({
        createCommits,
        commitPrefix,
        from,
        excludeAppliedMigrations,
        mode,
        agentic,
      }) => {
        // Only an explicit `--no-create-commits` is decidable here, before the
        // nx.json overlay runs: an explicit `false` can't be rescued by nx.json
        // (the CLI flag wins, and the agentic flow can't enable commits when
        // they're explicitly off). When `createCommits` is undefined, nx.json
        // may still enable commits, so defer to the post-overlay
        // `assertCommitPrefixHasCommits` check.
        if (
          createCommits === false &&
          customCommitPrefixHasNoEffect({
            createCommits,
            commitPrefix,
            agentic,
          })
        ) {
          throw new Error(
            'Error: Providing a custom commit prefix requires --create-commits to be enabled'
          );
        }
        if (excludeAppliedMigrations && !from && mode !== 'third-party') {
          throw new Error(
            'Error: Excluding migrations that should have been previously applied requires --from to be set'
          );
        }
        if (
          typeof agentic === 'string' &&
          !(AGENT_IDS as readonly string[]).includes(agentic)
        ) {
          throw new Error(
            `Error: Invalid --agentic value "${agentic}". Allowed: ${AGENT_IDS.join(
              ', '
            )}, true, false.`
          );
        }
        return true;
      }
    );
}
