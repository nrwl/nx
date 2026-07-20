import { lt, valid } from 'semver';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import { normalizeVersion } from './version-utils';

// The first stable release shipping --run-migration/--run-id. Deliberately
// the final release rather than its first prerelease: 23.2.0 prereleases
// published before the feature landed do not carry it, so a prerelease floor
// would wrongly accept them. Permanent; never bumped at release time.
export const NEW_MIGRATE_FLAGS_FLOOR = '23.2.0';

// yargs accepts both `--run-migration` and `--runMigration`, and the raw argv is
// forwarded verbatim across both migrate hops, so detection must catch every
// spelling of the new flags.
export const NEW_MIGRATE_FLAGS = [
  '--run-migration',
  '--runMigration',
  '--run-id',
  '--runId',
  '--step-action',
  '--stepAction',
] as const;

/**
 * The first new migrate flag present in `argv`, or undefined when none is. A
 * flag matches as an exact token or as `<flag>=<value>`; `--run-migrations`
 * (note the trailing s) never matches.
 */
export function findNewMigrateFlag(argv: string[]): string | undefined {
  for (const arg of argv) {
    // Everything after the -- separator is positional data, not options.
    if (arg === '--') {
      return undefined;
    }
    for (const flag of NEW_MIGRATE_FLAGS) {
      if (arg === flag || arg.startsWith(`${flag}=`)) {
        return flag;
      }
    }
  }
  return undefined;
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
 * `cliVersionSpec` is NX_MIGRATE_CLI_VERSION when set, else 'latest'. It is
 * resolved through `resolveVersion` unless it is already a concrete version.
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

  // valid() lets a concrete spec (e.g. '23.2.0' or 'v23.2.0') skip the
  // registry round-trip below; a non-concrete spec like 'latest' is null here
  // and falls through to resolveVersion.
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
 * drop them. Refuse when the local nx predates the feature floor.
 *
 * A workspace pinned to a feature-carrying 23.2.0 prerelease is refused here
 * too: published prereleases that predate the feature cannot be told apart by
 * version alone. Guard A's same-version bypass does not apply on this side
 * because the invoking nx's version is not forwarded across hop A; the
 * refusal names the workspace update that resolves it.
 *
 * `readLocalNxVersion` returns undefined when no readable nx install exists
 * at or above the workspace root; that case does not block. The hand-off
 * spawns the `nx migrate` wrapper, and without an nx installation to
 * delegate to it exits visibly rather than running anything.
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
