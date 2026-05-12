import { prompt } from 'enquirer';
import { gt, lt, major, minor, valid } from 'semver';
import { isCI } from '../../utils/is-ci';
import { getInstalledNxVersion } from '../../utils/installed-nx-version';
import { output } from '../../utils/output';
import { resolvePackageVersionUsingRegistry } from '../../utils/package-manager';
import {
  DIST_TAGS,
  type DistTag,
  isNxEquivalentTarget,
  normalizeVersionWithTagCheck,
} from './version-utils';

const STEPWISE_DOC_URL =
  'https://nx.dev/docs/guides/tips-n-tricks/advanced-update#one-major-version-at-a-time-small-steps';
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
  `See ${STEPWISE_DOC_URL}`,
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
      `Pass --multi-major-mode=direct (or =gradual) or set ${MULTI_MAJOR_MODE_ENV} to silence this warning.`,
    ],
  });
}

function logGradualStep(
  targetPackage: string,
  step: string,
  target: string
): void {
  output.log({
    title: `Migrating to ${targetPackage}@${step} (one step toward ${targetPackage}@${target}).`,
    bodyLines: [
      `Re-run \`nx migrate\` after this completes to continue toward ${targetPackage}@${target}.`,
    ],
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

export async function maybePromptOrWarnMultiMajorMigration(args: {
  mode: 'first-party' | 'third-party' | 'all';
  options: { multiMajorMode?: MultiMajorMode };
  targetPackage: string;
  targetVersion: string;
}): Promise<string> {
  const { mode, options, targetPackage } = args;
  let { targetVersion } = args;
  if (mode === 'third-party') return targetVersion;
  const multiMajorMode = resolveMultiMajorMode(options);
  if (multiMajorMode === 'direct') return targetVersion;
  if (!isNxEquivalentTarget(targetPackage, targetVersion)) return targetVersion;
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
      return targetVersion;
    }
  }
  if (!valid(targetVersion) || lt(targetVersion, '14.0.0-beta.0')) {
    return targetVersion;
  }
  const installed = getInstalledNxVersion();
  if (!installed || !valid(installed)) return targetVersion;
  // Legacy-era installs are out of scope for the multi-major check.
  if (lt(installed, '14.0.0-beta.0')) return targetVersion;
  const installedMajor = major(installed);
  if (major(targetVersion) - installedMajor < 2) return targetVersion;

  const interactive = !!process.stdin.isTTY && !isCI();
  // Non-TTY without gradual opt-in stays on the warn-only path; avoid the
  // registry round-trip used to resolve stepwise options.
  if (!interactive && multiMajorMode !== 'gradual') {
    warnMultiMajorMigration(targetPackage, installed, targetVersion);
    return targetVersion;
  }

  const [latestInCurrent, latestInNext] = await Promise.all([
    resolveLatestStableInMajor(targetPackage, installedMajor),
    resolveLatestStableInMajor(targetPackage, installedMajor + 1),
  ]);
  // Only suggest the current-major latest when there's at least a minor
  // delta — a same-minor patch bump isn't a meaningful "step" in stepwise
  // migration framing.
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
      return step;
    }
    // No stepwise option resolved → the requested target is effectively the
    // stepwise pick. Honour `gradual` silently.
    return targetVersion;
  }

  if (interactive && (showCurrent || latestInNext)) {
    return promptMultiMajorMigration({
      targetPackage,
      installed,
      target: targetVersion,
      latestInCurrent: showCurrent,
      latestInNext,
    });
  }
  warnMultiMajorMigration(targetPackage, installed, targetVersion);
  return targetVersion;
}
