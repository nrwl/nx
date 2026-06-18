import { readNxJson } from '../../config/configuration';
import { isCI } from '../../utils/is-ci';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import { resolveCatalogReferenceIfNeeded } from '../../utils/catalog';
import {
  resolvePackageVersionUsingInstallation,
  resolvePackageVersionUsingRegistry,
} from '../../utils/package-manager';
import { workspaceRoot } from '../../utils/workspace-root';
import { MinReleaseAgeViolationError } from '../../utils/min-release-age/errors';
import {
  readMinReleaseAgePolicy,
  type MinReleaseAgePolicy,
  type MinReleaseAgePolicyReadResult,
} from '../../utils/min-release-age/policy';
import { appendMinimumReleaseAgeExcludes } from '../../utils/min-release-age/pnpm-exclude-writer';
import { resolveCompliantVersion } from '../../utils/min-release-age/resolve';
import { migratePrompt } from './safe-prompt';

/**
 * Whether nx migrate should resolve versions via the npm registry (fast) rather
 * than via a real package-manager install. Precedence, highest first:
 *
 * 1. `NX_MIGRATE_USE_REGISTRY_RESOLUTION` ('true' -> enabled, 'false' -> disabled)
 * 2. legacy `NX_MIGRATE_SKIP_REGISTRY_FETCH` (deprecated, removed in Nx 24;
 *    'true' -> disabled, 'false' -> enabled)
 * 3. nx.json `migrate.useRegistryResolution`
 * 4. default: enabled
 */
export function isRegistryResolutionEnabled(
  root: string = workspaceRoot
): boolean {
  warnIfLegacyRegistryEnvVarSet();

  const explicit = parseBooleanFlag(
    process.env.NX_MIGRATE_USE_REGISTRY_RESOLUTION
  );
  if (explicit !== undefined) {
    return explicit;
  }

  // Legacy env is inverted: SKIP_REGISTRY_FETCH=true disables resolution.
  const legacy = parseBooleanFlag(process.env.NX_MIGRATE_SKIP_REGISTRY_FETCH);
  if (legacy !== undefined) {
    return !legacy;
  }

  return readNxJson(root)?.migrate?.useRegistryResolution ?? true;
}

function parseBooleanFlag(value: string | undefined): boolean | undefined {
  return value === 'true' ? true : value === 'false' ? false : undefined;
}

// NX_MIGRATE_SKIP_REGISTRY_FETCH is the inverted, legacy predecessor of
// NX_MIGRATE_USE_REGISTRY_RESOLUTION: deprecated in Nx 23, removed in Nx 24.
// Warn once whenever it is present (even when the new var overrides it) so users
// migrate off it and clean up configs where it lingers - a dormant value would
// silently re-activate if the new var were later removed.
function warnIfLegacyRegistryEnvVarSet(): void {
  if (
    legacyRegistryEnvVarDeprecationWarned ||
    process.env.NX_MIGRATE_SKIP_REGISTRY_FETCH === undefined
  ) {
    return;
  }
  legacyRegistryEnvVarDeprecationWarned = true;

  const bodyLines = [
    'Use NX_MIGRATE_USE_REGISTRY_RESOLUTION (or migrate.useRegistryResolution in nx.json) instead, then remove NX_MIGRATE_SKIP_REGISTRY_FETCH from your environment.',
  ];
  if (process.env.NX_MIGRATE_USE_REGISTRY_RESOLUTION !== undefined) {
    bodyLines.push(
      'It is currently being overridden by NX_MIGRATE_USE_REGISTRY_RESOLUTION.'
    );
  }
  output.warn({
    title:
      'NX_MIGRATE_SKIP_REGISTRY_FETCH is deprecated and will be removed in Nx 24.',
    bodyLines,
  });
}

// The cooldown policy is constant for a migrate run; read it once.
let cachedPolicyPromise: Promise<MinReleaseAgePolicyReadResult> | undefined;
// Dedup the "resolved X instead of Y" notice across repeated specs.
const reportedChangedOutcomes = new Set<string>();
// Strict-mode approval is a once-per-run decision (mirrors pnpm prompting once).
let strictApprovalGranted = false;
// The deprecated NX_MIGRATE_SKIP_REGISTRY_FETCH heads-up is shown once per run.
let legacyRegistryEnvVarDeprecationWarned = false;

/** Test-only: clear the module-level caches between cases. */
export function resetResolvePackageVersionState(): void {
  cachedPolicyPromise = undefined;
  reportedChangedOutcomes.clear();
  strictApprovalGranted = false;
  legacyRegistryEnvVarDeprecationWarned = false;
}

function getPolicy(): Promise<MinReleaseAgePolicyReadResult> {
  cachedPolicyPromise ??= readMinReleaseAgePolicy();
  return cachedPolicyPromise;
}

/**
 * The single resolution entry point for ALL nx migrate version resolutions. It
 * resolves a package spec to a concrete version while honoring the effective
 * minimum-release-age (cooldown) policy of the user's package manager, matching
 * how that PM at its detected version would resolve. Falls back to a real PM
 * install when the policy can't be reasoned about, or when registry resolution
 * is opted out.
 */
export async function resolvePackageVersionRespectingMinReleaseAge(
  packageName: string,
  version: string,
  options?: { applySideEffects?: boolean }
): Promise<string> {
  // A speculative lookup (e.g. populating multi-major prompt choices) sets this
  // to false so resolving a version the user has not chosen yet never prompts,
  // writes pnpm excludes, or triggers a real install.
  const applySideEffects = options?.applySideEffects ?? true;

  // A probe can never install, so the registry-resolution opt-out (which only
  // picks install vs. registry for the real resolution) does not apply to it: it
  // is always registry-based. Resolve read-only while still reproducing an active
  // cooldown so the probe predicts the same version a real install would accept.
  if (!applySideEffects) {
    return resolveProbe(packageName, version);
  }

  if (!isRegistryResolutionEnabled()) {
    return resolvePackageVersionUsingInstallation(packageName, version);
  }

  const result = await getPolicy();

  if (result.outcome === 'inactive') {
    return resolvePackageVersionUsingRegistry(packageName, version);
  }

  if (result.outcome === 'ambiguous') {
    logger.verbose(
      `Cannot determine the minimum-release-age policy (${result.reason}); falling back to a package-manager install to resolve ${packageName}@${version}.`
    );
    return resolvePackageVersionUsingInstallation(packageName, version);
  }

  return resolveWithPolicy(packageName, version, result.policy, true);
}

/**
 * Read-only resolution for speculative lookups (never installs, never prompts,
 * never writes excludes). Reproduces an active cooldown policy off the registry
 * so the probe's pick matches what a real install would accept. Degrades to the
 * raw latest-in-range when there is no policy to reproduce (inactive) or it
 * cannot be reasoned about (ambiguous) - the same read-only answer the real
 * resolution would refine via a package-manager install.
 */
async function resolveProbe(
  packageName: string,
  version: string
): Promise<string> {
  const result = await getPolicy();
  if (result.outcome !== 'active') {
    return resolvePackageVersionUsingRegistry(packageName, version);
  }
  return resolveWithPolicy(packageName, version, result.policy, false);
}

async function resolveWithPolicy(
  packageName: string,
  version: string,
  policy: MinReleaseAgePolicy,
  applySideEffects: boolean
): Promise<string> {
  try {
    const spec = resolveCatalogReferenceIfNeeded(packageName, version);
    const outcome = await resolveCompliantVersion(packageName, spec, policy);

    if (applySideEffects && outcome.version !== outcome.unconstrained) {
      reportChangedOutcome(
        packageName,
        spec,
        outcome.version,
        outcome.unconstrained,
        policy
      );
    }

    // An immature loose pick is returned as-is. nx does not write the
    // minimumReleaseAgeExclude entry here: migrate does not replace the install,
    // so the real `pnpm install` (>=11.1.3) auto-writes it itself.
    return outcome.version;
  } catch (e) {
    // A side-effect-free probe never installs/prompts/writes, so any failure -
    // a violation or an unknown error - just means the version is unavailable.
    if (!applySideEffects) {
      throw e;
    }
    if (e instanceof MinReleaseAgeViolationError) {
      return handleViolation(packageName, e, policy);
    }
    // Unknown failure (registry hiccup, parse error): try a real install, but
    // surface the original error if that also fails.
    try {
      return await resolvePackageVersionUsingInstallation(packageName, version);
    } catch {
      throw e;
    }
  }
}

function reportChangedOutcome(
  packageName: string,
  spec: string,
  picked: string,
  unconstrained: string,
  policy: MinReleaseAgePolicy
): void {
  const key = `${packageName}@${spec}`;
  if (reportedChangedOutcomes.has(key)) {
    return;
  }
  reportedChangedOutcomes.add(key);
  output.log({
    title: `Resolved ${packageName}@${picked} instead of ${unconstrained}: ${policy.sourceDescription}.`,
  });
}

async function handleViolation(
  packageName: string,
  error: MinReleaseAgeViolationError,
  policy: MinReleaseAgePolicy
): Promise<string> {
  const isPnpmStrict =
    policy.behavior.packageManager === 'pnpm' &&
    policy.behavior.strict &&
    policy.behavior.writesExcludes;

  if (!isPnpmStrict) {
    throw error;
  }

  // An unknown tag yields a violation with no blocked candidates (nothing to
  // approve); surface the original no-matching-version error rather than
  // prompting over an empty list.
  if (error.blocked.length === 0) {
    throw error;
  }

  // pnpm gates its prompt on stdin (the surface enquirer reads); match that
  // rather than stdout, which diverges when output is piped.
  const canPrompt = !!process.stdin.isTTY && !isCI();
  if (!canPrompt) {
    throw error;
  }

  // pnpm's loose resolver picks the lowest in-range version (a single exact/tag
  // target otherwise); strict fails on exactly that pick. error.blocked is
  // sorted newest-first, so the resolver's pick is the last entry. Mirror the
  // loose path: prompt for, exclude, and return that one version.
  const resolved = error.blocked[error.blocked.length - 1];
  const blockedLine = `  ${packageName}@${resolved.version} (published ${formatPublishAge(
    resolved.publishedAt
  )})`;

  // pnpm prompts once for the whole run; remember an approval for later picks.
  if (!strictApprovalGranted) {
    const { approved } = await migratePrompt<{ approved: boolean }>([
      {
        name: 'approved',
        type: 'confirm',
        initial: false,
        message: `The following version does not meet the ${policy.sourceDescription} constraint:\n${blockedLine}\nInstall anyway and add it to minimumReleaseAgeExclude in pnpm-workspace.yaml?`,
      },
    ]);

    if (!approved) {
      // Deny must surface as a violation: migrate.ts only rethrows
      // MinReleaseAgeViolationError, so a plain Error would silently fall back
      // to a real PM install and defeat the deny gate. Shape it like pnpm's
      // ERR_PNPM_MINIMUM_RELEASE_AGE_DENIED.
      throw new MinReleaseAgeViolationError({
        packageManager: error.packageManager,
        packageName: error.packageName,
        spec: error.spec,
        pmShapedDetail: 'Aborted: the immature versions were not approved.',
        blocked: error.blocked,
        remediation: [
          `Add ${packageName} (optionally with a version) to minimumReleaseAgeExclude in pnpm-workspace.yaml, or re-run without minimumReleaseAgeStrict to allow these versions.`,
        ],
      });
    }
    strictApprovalGranted = true;
  }

  appendMinimumReleaseAgeExcludes(workspaceRoot, [
    `${packageName}@${resolved.version}`,
  ]);

  return resolved.version;
}

// Renders a registry ISO publish timestamp as a human age for the strict prompt
// (e.g. "6 hours ago"), falling back to the raw value when it is not parseable.
function formatPublishAge(publishedAt: string): string {
  const elapsedMs = Date.now() - Date.parse(publishedAt);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return publishedAt;
  }
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  const hours = Math.floor(elapsedMs / 3_600_000);
  if (hours < 48) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(elapsedMs / 86_400_000);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
