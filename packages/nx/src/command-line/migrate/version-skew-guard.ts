import { lt, valid } from 'semver';
import { normalizeVersion } from './version-utils';

// First nx version shipping --run-migration. Bump this if the feature slips
// to a later release.
export const NEW_MIGRATE_FLAGS_FLOOR = '23.2.0-beta.0';

// The release users see in guidance (floor without its prerelease suffix).
const NEW_MIGRATE_FLAGS_FLOOR_RELEASE = NEW_MIGRATE_FLAGS_FLOOR.split('-')[0];

// yargs accepts both `--run-migration` and `--runMigration`, and the raw argv is
// forwarded verbatim across both migrate hops, so detection must catch every
// spelling of the new flags.
export const NEW_MIGRATE_FLAGS = ['--run-migration', '--runMigration'] as const;

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
 * the temp CLI it is about to install may be older and would silently drop
 * them. Resolve the temp CLI version and refuse up front when it predates the
 * feature floor.
 *
 * `cliVersionSpec` is NX_MIGRATE_CLI_VERSION when set, else 'latest'. It is
 * resolved through `resolveVersion` unless it is already a concrete version.
 * A resolution failure skips the guard instead of blocking: it is not
 * evidence of version skew, so the install and its own failure/fallback
 * handling decide from here.
 */
export async function assertTempCliSupportsNewMigrateFlags(options: {
  argv: string[];
  cliVersionSpec: string;
  fromEnvOverride: boolean;
  resolveVersion: (spec: string) => Promise<string>;
}): Promise<void> {
  const flag = findNewMigrateFlag(options.argv);
  if (!flag) {
    return;
  }

  // valid() lets a concrete spec (e.g. '23.2.0' or 'v23.2.0') skip the
  // registry round-trip below; a non-concrete spec like 'latest' is null here
  // and falls through to resolveVersion.
  const concrete = valid(options.cliVersionSpec);
  let resolved: string;
  try {
    resolved =
      concrete ?? (await options.resolveVersion(options.cliVersionSpec));
  } catch {
    return;
  }

  if (!lt(normalizeVersion(resolved), NEW_MIGRATE_FLAGS_FLOOR)) {
    return;
  }

  let message =
    `The nx version 'nx migrate' is about to install (${resolved}) does not support ${flag}. ` +
    `This flag ships in nx ${NEW_MIGRATE_FLAGS_FLOOR_RELEASE} or newer.`;
  if (options.fromEnvOverride) {
    message +=
      ` NX_MIGRATE_CLI_VERSION is set to '${options.cliVersionSpec}'. ` +
      `Unset it or set it to nx ${NEW_MIGRATE_FLAGS_FLOOR_RELEASE} or newer.`;
  }
  throw new Error(message);
}

/**
 * Guard B (temp side, before hop B). The temp CLI knows the new flags, but the
 * workspace-local nx it is about to hand off to may be older and would silently
 * drop them. Refuse when the local nx predates the feature floor.
 *
 * `readLocalNxVersion` returns undefined when the local nx version cannot be
 * read; that case does not block (the downstream hand-off surfaces its own
 * failure, with a clearer error).
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
    throw new Error(
      `The workspace's installed nx (${localNxVersion}) does not support ${flag}. ` +
        `Update the workspace to nx ${NEW_MIGRATE_FLAGS_FLOOR_RELEASE} or newer first, ` +
        `for example by running 'nx migrate nx@latest' (without ${flag}) or by updating your dependencies.`
    );
  }
}
