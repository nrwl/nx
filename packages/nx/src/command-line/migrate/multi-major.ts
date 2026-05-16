import { prompt } from 'enquirer';
import { gt, major, minor, valid } from 'semver';
import { isCI } from '../../utils/is-ci';
import { getInstalledNxVersion } from '../../utils/installed-nx-version';
import { output } from '../../utils/output';
import { resolvePackageVersionUsingRegistry } from '../../utils/package-manager';
import type { MigrateMode } from './migrate';
import {
  DIST_TAGS,
  type DistTag,
  isLegacyEra,
  isNxEquivalentTarget,
  normalizeVersionWithTagCheck,
} from './version-utils';

const INCREMENTAL_UPDATE_GUIDE_URL =
  'https://nx.dev/docs/guides/tips-n-tricks/advanced-update#one-major-version-at-a-time-small-steps';
export const MULTI_MAJOR_MODE_FLAG = '--multi-major-mode';
const MULTI_MAJOR_MODE_ENV = 'NX_MULTI_MAJOR_MODE';

export type MultiMajorMode = 'direct' | 'gradual';

// Caret-major (`^X.0.0`) excludes prereleases per semver, so
// `resolvePackageVersionUsingRegistry` returns the highest stable in major X.
async function resolveLatestStableInMajor(
  packageName: string,
  majorVersion: number
): Promise<string | null> {
  try {
    const resolved = await resolvePackageVersionUsingRegistry(
      packageName,
      `^${majorVersion}.0.0`
    );
    return valid(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

const multiMajorHeader = (pkg: string, installed: string, target: string) =>
  `Migrating across multiple major versions: ${pkg}@${installed} → ${pkg}@${target}.`;

const multiMajorBodyLines = [
  `The recommended process is to update one major version at a time, in small steps.`,
  `See ${INCREMENTAL_UPDATE_GUIDE_URL}`,
];

function warnMultiMajorMigration(
  targetPackage: string,
  installed: string,
  target: string
): void {
  output.warn({
    title: multiMajorHeader(targetPackage, installed, target),
    bodyLines: [
      ...multiMajorBodyLines,
      `Pass ${MULTI_MAJOR_MODE_FLAG}=direct (or =gradual) or set ${MULTI_MAJOR_MODE_ENV} to silence this warning.`,
    ],
  });
}

function logGradualStep(
  targetPackage: string,
  step: string,
  target: string
): void {
  // Status-only announcement. The follow-up instruction ("re-run `nx migrate`
  // to continue toward the original target") lives in the Next Steps block at
  // the end of the run, where it's adjacent to the other re-run guidance and
  // not scrolled out of view by the migration output.
  output.log({
    title: `Migrating to ${targetPackage}@${step} (one step toward ${targetPackage}@${target}).`,
  });
}

function warnGradualUnavailable(
  targetPackage: string,
  target: string,
  reason: string
): void {
  output.warn({
    title: `Could not look up incremental migration options for ${MULTI_MAJOR_MODE_FLAG}=gradual. Proceeding directly to ${targetPackage}@${target}.`,
    bodyLines: [reason],
  });
}

// Returns the chosen target version. Caller replaces `targetVersion` with it.
// At least one of `latestInCurrent`/`latestInNext` must be present.
async function promptMultiMajorMigration(args: {
  targetPackage: string;
  installed: string;
  target: string;
  latestInCurrent: string | null;
  latestInNext: string | null;
}): Promise<string> {
  const choices: { name: string; message: string }[] = [];
  let recommendedMarked = false;
  if (args.latestInCurrent) {
    choices.push({
      name: args.latestInCurrent,
      message: `Migrate to ${args.targetPackage}@${args.latestInCurrent} (latest in current major) [recommended]`,
    });
    recommendedMarked = true;
  }
  if (args.latestInNext) {
    choices.push({
      name: args.latestInNext,
      message: `Migrate to ${args.targetPackage}@${args.latestInNext} (next major)${
        recommendedMarked ? '' : ' [recommended]'
      }`,
    });
  }
  choices.push({
    name: args.target,
    message: `Migrate directly to ${args.targetPackage}@${args.target}`,
  });
  output.log({
    title: multiMajorHeader(args.targetPackage, args.installed, args.target),
    bodyLines: multiMajorBodyLines,
  });
  const { chosen } = await prompt<{ chosen: string }>({
    type: 'select',
    name: 'chosen',
    message: 'How would you like to proceed?',
    choices,
  });
  return chosen;
}

// Flag wins over env var; only the two literal values are honoured.
function resolveMultiMajorMode(options: {
  multiMajorMode?: MultiMajorMode;
}): MultiMajorMode | undefined {
  if (
    options.multiMajorMode === 'direct' ||
    options.multiMajorMode === 'gradual'
  ) {
    return options.multiMajorMode;
  }
  const env = process.env[MULTI_MAJOR_MODE_ENV];
  if (env === 'direct' || env === 'gradual') return env;
  return undefined;
}

/**
 * Result of running the multi-major check.
 *
 * - `chosen`: the version to actually migrate to (always concrete semver when
 *   the function ran past the dist-tag resolution; otherwise the input value).
 * - `originalTarget`: set only when an actual redirect happened (gradual mode
 *   auto-picked a smaller step, OR the interactive prompt returned a version
 *   different from the resolved target). Holds the concrete resolved target
 *   so callers can suggest re-running toward it.
 * - `gradual`: set only when the redirect came from gradual mode (flag or
 *   env). Tells callers it's safe to propagate `--multi-major-mode=gradual`
 *   to a continuation command; left unset when the redirect came from the
 *   interactive prompt so the user isn't silently locked into gradual.
 */
export type MultiMajorResult = {
  chosen: string;
  originalTarget?: string;
  gradual?: boolean;
};

export async function maybePromptOrWarnMultiMajorMigration(args: {
  mode: MigrateMode;
  options: { multiMajorMode?: MultiMajorMode };
  targetPackage: string;
  targetVersion: string;
}): Promise<MultiMajorResult> {
  const { mode, options, targetPackage } = args;
  let { targetVersion } = args;
  if (mode === 'third-party') return { chosen: targetVersion };
  const multiMajorMode = resolveMultiMajorMode(options);
  if (multiMajorMode === 'direct') return { chosen: targetVersion };
  if (!isNxEquivalentTarget(targetPackage, targetVersion)) {
    return { chosen: targetVersion };
  }
  // Bare-package-name positionals (e.g. `nx migrate nx`, `nx migrate
  // @nx/workspace`) leave `targetVersion` as the literal `'latest'` because
  // `parseTargetPackageAndVersion` only resolves dist-tags via the registry
  // when they appear standalone or after `@`. Resolve here so the remaining
  // semver gates (and the subsequent walk) see a concrete version.
  if (DIST_TAGS.includes(targetVersion as DistTag)) {
    try {
      targetVersion = await normalizeVersionWithTagCheck(
        targetPackage,
        targetVersion
      );
    } catch {
      if (multiMajorMode === 'gradual') {
        warnGradualUnavailable(
          targetPackage,
          targetVersion,
          `Failed to resolve the '${targetVersion}' dist-tag against the registry.`
        );
      }
      return { chosen: targetVersion };
    }
  }
  if (!valid(targetVersion) || isLegacyEra(targetVersion)) {
    return { chosen: targetVersion };
  }
  const installed = getInstalledNxVersion();
  if (!installed || !valid(installed)) return { chosen: targetVersion };
  // Legacy-era installs are out of scope for the multi-major check.
  if (isLegacyEra(installed)) return { chosen: targetVersion };
  const installedMajor = major(installed);
  if (major(targetVersion) - installedMajor < 2) {
    return { chosen: targetVersion };
  }

  const interactive = !!process.stdin.isTTY && !isCI();
  // Non-TTY without gradual opt-in stays on the warn-only path; avoid the
  // registry round-trip used to look up incremental migration options.
  if (!interactive && multiMajorMode !== 'gradual') {
    warnMultiMajorMigration(targetPackage, installed, targetVersion);
    return { chosen: targetVersion };
  }

  const [latestInCurrent, latestInNext] = await Promise.all([
    resolveLatestStableInMajor(targetPackage, installedMajor),
    resolveLatestStableInMajor(targetPackage, installedMajor + 1),
  ]);
  // Only suggest the current-major latest when there's at least a minor
  // delta — a same-minor patch bump isn't a meaningful incremental step.
  const showCurrent =
    latestInCurrent &&
    gt(latestInCurrent, installed) &&
    minor(latestInCurrent) > minor(installed)
      ? latestInCurrent
      : null;

  if (multiMajorMode === 'gradual') {
    const step = showCurrent ?? latestInNext;
    if (step) {
      logGradualStep(targetPackage, step, targetVersion);
      return { chosen: step, originalTarget: targetVersion, gradual: true };
    }
    // Registry returned no eligible incremental version (or the lookup
    // failed); without a step to land on, gradual silently degrades to direct.
    // Surface that explicitly so the safety rail the user opted into isn't
    // invisibly disabled.
    warnGradualUnavailable(
      targetPackage,
      targetVersion,
      `Could not find an eligible version in major ${installedMajor} or ${
        installedMajor + 1
      } (registry lookup returned no result or failed).`
    );
    return { chosen: targetVersion };
  }

  if (interactive && (showCurrent || latestInNext)) {
    const chosen = await promptMultiMajorMigration({
      targetPackage,
      installed,
      target: targetVersion,
      latestInCurrent: showCurrent,
      latestInNext,
    });
    return chosen !== targetVersion
      ? { chosen, originalTarget: targetVersion }
      : { chosen };
  }
  warnMultiMajorMigration(targetPackage, installed, targetVersion);
  return { chosen: targetVersion };
}
