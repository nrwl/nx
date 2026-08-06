import { lt, valid } from 'semver';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import { normalizeVersion } from './version-utils';

// The first stable release shipping --run-migration/--run-id. Deliberately
// the final release rather than its first prerelease: 23.2.0 prereleases
// published before the feature landed do not carry it, so a prerelease floor
// would wrongly accept them. The cost is that a later 23.2.0 prerelease that
// does carry the feature is refused too, which fails toward refusal.
// Permanent; never bumped at release time, but it must name the release that
// actually ships the feature: if that slips past 23.2.0, versions in the gap
// pass this floor and route to a temp CLI that drops the new flags and runs
// the plan phase instead.
export const NEW_MIGRATE_FLAGS_FLOOR = '23.2.0';

// yargs accepts both spellings of each flag and the raw argv is forwarded
// across both migrate hops, so detection must catch every one.
export const NEW_MIGRATE_FLAGS = [
  '--run-migration',
  '--runMigration',
  '--run-id',
  '--runId',
  '--step-action',
  '--stepAction',
] as const;

const RUN_ID_FLAGS = ['--run-id', '--runId'] as const;

/**
 * Matches an exact token or `<flag>=<value>`. The `=` matters: a bare
 * `startsWith` would also match `--run-migrations` (trailing s).
 */
function findFlag(
  argv: string[],
  flags: readonly string[]
): string | undefined {
  for (const arg of argv) {
    // Everything after the -- separator is positional data, not options.
    if (arg === '--') {
      return undefined;
    }
    for (const flag of flags) {
      if (arg === flag || arg.startsWith(`${flag}=`)) {
        return flag;
      }
    }
  }
  return undefined;
}

export function findNewMigrateFlag(argv: string[]): string | undefined {
  return findFlag(argv, NEW_MIGRATE_FLAGS);
}

/**
 * Whether the invocation names an existing orchestrated run. Such an
 * invocation has to execute against the workspace-local nx that owns the run's
 * state under `.nx/migrate-runs`, so it never routes to a temp installation.
 */
export function targetsExistingRun(argv: string[]): boolean {
  return findFlag(argv, RUN_ID_FLAGS) !== undefined;
}

/**
 * Guard A (local side, before hop A). The current nx knows the new flags, but
 * the temp CLI 'nx migrate' is about to install may be older and would
 * silently drop them. Decides where a new-flag invocation runs:
 *
 * - No new flag in `argv`, or the temp CLI version resolves at or above the
 *   feature floor: 'temp-cli', the normal temp-installation path.
 * - The temp CLI resolves below the floor, or resolution fails (a registry
 *   error, or a minimum-release-age violation that a temp install must not
 *   bypass): 'local-nx', provided the workspace-local nx can take the flags.
 *   The local nx qualifies when it is the exact version running this code
 *   (it parsed the flag, so it supports it regardless of the floor) or is at
 *   or above the floor. An unreadable local version throws: the hand-off's
 *   spawn normally lands on the very install this read verifies, and a
 *   layout where the version cannot be read gives no such assurance, so
 *   handing off blind could run a below-floor nx that silently drops the
 *   flag.
 * - Neither side is capable: throw with remediation.
 *
 * An explicit NX_MIGRATE_CLI_VERSION pinned below the floor throws instead of
 * silently overriding the user's pin with the local fallback.
 *
 * `cliVersionSpec` is NX_MIGRATE_CLI_VERSION when set, else 'latest'.
 */
export async function resolveNewMigrateFlagsRunTarget(options: {
  argv: string[];
  cliVersionSpec: string;
  fromEnvOverride: boolean;
  ownNxVersion: string;
  resolveVersion: (spec: string) => Promise<string>;
  readLocalNxVersion: () => string | undefined;
}): Promise<'temp-cli' | 'local-nx'> {
  const flag = findNewMigrateFlag(options.argv);
  if (!flag) {
    return 'temp-cli';
  }

  // `valid()` returns null for a dist-tag like 'latest' and a normalized
  // version for a concrete spec, which then skips the registry round-trip.
  const concrete = valid(options.cliVersionSpec);
  let resolved: string | undefined;
  try {
    resolved =
      concrete ?? (await options.resolveVersion(options.cliVersionSpec));
  } catch (e) {
    // The local-fallback check below decides what a failed resolution means.
    logger.verbose(
      `Could not resolve the nx version for '${options.cliVersionSpec}': ${e}`
    );
  }

  if (
    resolved !== undefined &&
    !lt(normalizeVersion(resolved), NEW_MIGRATE_FLAGS_FLOOR)
  ) {
    return 'temp-cli';
  }

  if (resolved !== undefined && options.fromEnvOverride) {
    throw new Error(
      `The nx version 'nx migrate' is about to install (${resolved}) does not support ${flag}. ` +
        `This flag ships in nx ${NEW_MIGRATE_FLAGS_FLOOR} or newer. ` +
        `NX_MIGRATE_CLI_VERSION is set to '${options.cliVersionSpec}'. ` +
        `Unset it or set it to nx ${NEW_MIGRATE_FLAGS_FLOOR} or newer.`
    );
  }

  const localNxVersion = options.readLocalNxVersion();
  if (
    localNxVersion !== undefined &&
    (localNxVersion === options.ownNxVersion ||
      !lt(normalizeVersion(localNxVersion), NEW_MIGRATE_FLAGS_FLOOR))
  ) {
    // A pinned spec reaching this point failed to resolve: a resolved pin
    // either returned 'temp-cli' or threw above.
    if (options.fromEnvOverride) {
      output.warn({
        title: `The nx version pinned by NX_MIGRATE_CLI_VERSION ('${options.cliVersionSpec}') could not be resolved. Running ${flag} with the workspace's installed nx (${localNxVersion}) instead.`,
      });
    }
    return 'local-nx';
  }

  const tempSideOutcome =
    resolved !== undefined
      ? `resolves to ${resolved}, which does not support it`
      : `could not be resolved`;
  const localSideOutcome =
    localNxVersion !== undefined
      ? `the workspace's installed nx (${localNxVersion}) does not support it either`
      : `the workspace's installed nx version could not be read to verify support`;
  // The worked example assumes the steady state, where 'latest' satisfies
  // the floor: this branch then fires only when the spec could not be
  // resolved (default or pinned), and updating the workspace to latest
  // genuinely fixes it. Before the floor's stable release the example
  // cannot resolve high enough; that window is deliberately not catered
  // for, since no stable release carries the flags then anyway.
  throw new Error(
    `${flag} requires nx ${NEW_MIGRATE_FLAGS_FLOOR} or newer. ` +
      `'${options.cliVersionSpec}' (the version 'nx migrate' would install) ${tempSideOutcome}, ` +
      `and ${localSideOutcome}. ` +
      `Update the workspace to nx ${NEW_MIGRATE_FLAGS_FLOOR} or newer first, ` +
      `for example by running 'nx migrate nx@latest' (without ${flag}) or by updating your dependencies.`
  );
}

/**
 * Guard B (temp side, before hop B). The temp CLI knows the new flags, but the
 * workspace-local nx it is about to hand off to may be older and would silently
 * drop them.
 *
 * A workspace pinned to a feature-carrying 23.2.0 prerelease is refused here
 * too: published prereleases that predate the feature cannot be told apart by
 * version alone. Guard A's same-version bypass does not apply on this side
 * because the invoking nx's version is not forwarded across hop A; the
 * refusal names the workspace update that resolves it.
 *
 * `readLocalNxVersion` returning undefined does not block: the hand-off then
 * resolves nx as it always does, which may fail visibly or land on another nx
 * the package manager locates.
 */
export function assertWorkspaceNxSupportsNewMigrateFlags(options: {
  argv: string[];
  readLocalNxVersion: () => string | undefined;
}): void {
  const flag = findNewMigrateFlag(options.argv);
  if (!flag) {
    return;
  }

  const localNxVersion = options.readLocalNxVersion();
  if (!localNxVersion) {
    return;
  }

  if (lt(normalizeVersion(localNxVersion), NEW_MIGRATE_FLAGS_FLOOR)) {
    // The worked example assumes the steady state (latest at or above the
    // floor); the pre-floor stable window is deliberately not catered for.
    throw new Error(
      `The workspace's installed nx (${localNxVersion}) does not support ${flag}. ` +
        `Update the workspace to nx ${NEW_MIGRATE_FLAGS_FLOOR} or newer first, ` +
        `for example by running 'nx migrate nx@latest' (without ${flag}) or by updating your dependencies.`
    );
  }
}
