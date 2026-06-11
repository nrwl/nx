import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { rcompare, satisfies, valid } from 'semver';
import { parse as parseToml } from 'smol-toml';
import { MS_PER_DAY, MS_PER_SECOND } from '../constants';
import { MinReleaseAgeViolationError } from '../errors';
import type { RegistryMetadata } from '../packument';
import {
  blockedVersionsFrom,
  classifySpec,
  degradeTagToCompliant,
  type PickOutcome,
} from '../pick';
import type {
  MinReleaseAgePolicy,
  MinReleaseAgePolicyReadResult,
} from '../policy';

const SEVEN_DAYS_MS = 7 * MS_PER_DAY;

interface BunInstallConfig {
  minimumReleaseAge?: unknown;
  minimumReleaseAgeExcludes?: string[];
}

/**
 * Reads bun's cooldown config from bunfig.toml. nx mirrors only the surfaces
 * bun reads at resolution time in this context: the project `bunfig.toml` and
 * the global bunfig, which lives at `$XDG_CONFIG_HOME/.bunfig.toml` when
 * XDG_CONFIG_HOME is set and at `$HOME/.bunfig.toml` otherwise (verified
 * against bun's getHomeConfigPath). Local overrides global per key. No env,
 * no .npmrc, no CLI surface exists in this context.
 */
export async function readBunPolicy(
  root: string,
  pmVersion: string
): Promise<MinReleaseAgePolicyReadResult> {
  let global: BunInstallConfig | 'error';
  let local: BunInstallConfig | 'error';
  try {
    global = readGlobalBunInstall();
    local = readLocalBunInstall(root);
  } catch {
    return {
      outcome: 'ambiguous',
      reason: 'Unable to read bunfig.toml.',
    };
  }
  if (global === 'error' || local === 'error') {
    // A non-number / negative value makes bun's config load fail (install
    // dies); we can't reason about the effective window, so defer to install.
    return {
      outcome: 'ambiguous',
      reason: 'Invalid minimumReleaseAge in bunfig.toml.',
    };
  }

  // Local overrides global per key.
  const ageRaw = local.minimumReleaseAge ?? global.minimumReleaseAge;
  const excludesRaw =
    local.minimumReleaseAgeExcludes ?? global.minimumReleaseAgeExcludes;

  if (ageRaw === undefined || ageRaw === null) {
    return { outcome: 'inactive' };
  }
  if (typeof ageRaw !== 'number' || !Number.isFinite(ageRaw)) {
    return {
      outcome: 'ambiguous',
      reason: `Invalid bun minimumReleaseAge value: ${String(ageRaw)}.`,
    };
  }
  if (ageRaw < 0) {
    // bun hard-errors on a negative window; install would die.
    return {
      outcome: 'ambiguous',
      reason: 'bun minimumReleaseAge must be a positive number of seconds.',
    };
  }
  if (ageRaw === 0) {
    // 0 disables the gate.
    return { outcome: 'inactive' };
  }

  const excludes = new Set(excludesRaw ?? []);
  const windowMs = ageRaw * MS_PER_SECOND;
  const cutoffMs = Date.now() - windowMs;
  return {
    outcome: 'active',
    policy: {
      packageManagerVersion: pmVersion,
      cutoffMs,
      windowMs,
      sourceDescription: `bun minimumReleaseAge (${ageRaw} second${
        ageRaw === 1 ? '' : 's'
      })`,
      // Exact, case-sensitive byte equality on the package name only.
      isExcluded: (packageName) => excludes.has(packageName),
      behavior: { packageManager: 'bun' },
    },
  };
}

function readLocalBunInstall(root: string): BunInstallConfig | 'error' {
  return readBunInstall(join(root, 'bunfig.toml'));
}

function readGlobalBunInstall(): BunInstallConfig | 'error' {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg || process.env.HOME;
  if (!base) {
    return {};
  }
  return readBunInstall(join(base, '.bunfig.toml'));
}

function readBunInstall(path: string): BunInstallConfig | 'error' {
  if (!existsSync(path)) {
    return {};
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = parseToml(readFileSync(path, 'utf-8')) as Record<string, unknown>;
  } catch {
    // Unparseable bunfig makes bun's install die; treat as a hard error.
    return 'error';
  }
  const install = parsed.install;
  if (typeof install !== 'object' || install === null) {
    return {};
  }
  const installObj = install as Record<string, unknown>;
  const result: BunInstallConfig = {};
  if ('minimumReleaseAge' in installObj) {
    const value = installObj.minimumReleaseAge;
    // bun rejects a non-number value (config load fails); negative is rejected
    // too but we surface that uniformly in the reader for a clearer reason.
    if (typeof value !== 'number') {
      return 'error';
    }
    result.minimumReleaseAge = value;
  }
  if ('minimumReleaseAgeExcludes' in installObj) {
    const value = installObj.minimumReleaseAgeExcludes;
    // bun's bunfig parser hard-errors on a non-array, or any non-string element
    // (install dies); mirror that so the reader maps it to ambiguous.
    if (!Array.isArray(value) || value.some((e) => typeof e !== 'string')) {
      return 'error';
    }
    result.minimumReleaseAgeExcludes = value;
  }
  // The singular `minimumReleaseAgeExclude` key is never read by bun; ignore it.
  return result;
}

/**
 * bun resolution. Exact pins and ranges mirror bun's resolver
 * (find_best_version_with_filter, byte-identical 1.3.0 -> 1.3.14); dist-tag
 * degrade uses the shared cross-PM rule:
 * - exact pin too new -> hard error (TooRecentVersion), no fallback.
 * - range -> the `latest` dist-tag is checked first: in-range and age-passing ->
 *   return it immediately. Otherwise walk newest to oldest skipping age-blocked;
 *   the first age-passing candidate must also be stable (gap to the next-newer
 *   version >= min(window, 7d), inclusive); unstable -> keep walking but remember
 *   it; stop past `now - (window + 7d)`; no stable -> newest age-passing fallback.
 *   No in-range version at all -> err.not_found (a plain, non-cooldown error).
 * - dist-tag too new -> degrade to the newest compliant version in the tag's
 *   own channel, falling back to stable (`degradeTagToCompliant`); none ->
 *   TooRecentVersion.
 * Missing/unparseable publish times are treated as timestamp 0 (always pass);
 * future timestamps are blocked.
 */
export function pickBunVersion(
  spec: string,
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy
): PickOutcome {
  const type = classifySpec(spec);

  if (type === 'exact') {
    if (passesGate(metadata, policy, spec)) {
      return { version: spec, unconstrained: spec };
    }
    throw tooRecent(metadata, policy, spec);
  }

  if (type === 'tag') {
    const target = metadata.distTags[spec];
    if (!target) {
      throw tooRecent(metadata, policy, spec);
    }
    if (passesGate(metadata, policy, target)) {
      return { version: target, unconstrained: target };
    }
    const degraded = degradeTagToCompliant(target, metadata, (v) =>
      passesGate(metadata, policy, v)
    );
    if (degraded) {
      return { version: degraded, unconstrained: target };
    }
    throw tooRecent(metadata, policy, spec);
  }

  // bun splits its manifest into a stable `releases` list and a `prereleases`
  // list and only consults prereleases when the range itself carries a
  // prerelease comparator (npm.zig findBestVersionWithFilter, Group.Flags.pre).
  // Default node-semver semantics replicate that: a prerelease version is only
  // admitted when the range has a comparator with the same [major,minor,patch].
  const inRange = metadata.versions
    .filter((v) => satisfies(v, spec))
    .sort(rcompare);
  const unconstrained = inRange[0] ?? spec;

  // No in-range version at all is bun's err.not_found (NOT a cooldown error); a
  // plain Error lets the migrate install-fallback surface bun's NoMatchingVersion.
  if (inRange.length === 0) {
    throw new Error(`No matching version found for ${metadata.name}@${spec}.`);
  }

  // bun's findBestVersionWithFilter checks the `latest` dist-tag first: if it
  // satisfies the range and passes the gate, it returns immediately, before the
  // stability walk (npm.zig findBestVersionWithFilter, findByDistTag("latest")).
  const latest = metadata.distTags['latest'];
  if (
    latest &&
    satisfies(latest, spec) &&
    passesGate(metadata, policy, latest)
  ) {
    return { version: latest, unconstrained };
  }

  const picked = walkStability(metadata, policy, inRange, null);
  if (picked) {
    return { version: picked, unconstrained };
  }
  throw tooRecent(metadata, policy, spec);
}

/**
 * Walks `candidates` (already sorted newest-first) applying bun's stability
 * heuristic. `tagTarget`, when set, seeds the prior age-blocked version so the
 * gap is measured against the tag's resolved version. Returns the picked
 * version, or null when every candidate is blocked.
 */
function walkStability(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  candidates: string[],
  tagTarget: string | null
): string | null {
  const now = Date.now();
  const stabilityWindowMs = Math.min(policy.windowMs, SEVEN_DAYS_MS);
  const searchBoundMs = now - (policy.windowMs + SEVEN_DAYS_MS);

  let prevBlocked: string | null = tagTarget;
  let best: string | null = null;

  for (const version of candidates) {
    if (!passesGate(metadata, policy, version)) {
      prevBlocked = version;
      continue;
    }
    if (prevBlocked === null) {
      // Newest age-passing candidate with nothing newer blocked: take it.
      return version;
    }
    if (publishMs(metadata, version) < searchBoundMs) {
      // Past the search bound: stop and use the best age-passing version found.
      return best ?? version;
    }
    const stable =
      publishMs(metadata, prevBlocked) - publishMs(metadata, version) >=
      stabilityWindowMs;
    if (stable) {
      return version;
    }
    best ??= version;
    prevBlocked = version;
  }

  // No stable candidate: fall back to the newest age-passing version, if any.
  return best;
}

// A version passes when its publish time is at or before the cutoff
// (inclusive), or when it is excluded. Missing time -> timestamp 0 -> passes.
function passesGate(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  version: string
): boolean {
  if (policy.isExcluded(metadata.name, version)) {
    return true;
  }
  return publishMs(metadata, version) <= policy.cutoffMs;
}

// Publish time in epoch ms; missing/unparseable -> 0 (bun's timestamp default).
function publishMs(metadata: RegistryMetadata, version: string): number {
  const time = metadata.time?.[version];
  if (!time) {
    return 0;
  }
  const parsed = Date.parse(time);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function tooRecent(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  spec: string
): MinReleaseAgeViolationError {
  const blocked = blockedCandidates(metadata, spec);
  return new MinReleaseAgeViolationError({
    packageManager: 'bun',
    packageName: metadata.name,
    spec,
    pmShapedDetail: `${metadata.name}@${spec} was blocked by minimum-release-age (${policy.sourceDescription}).`,
    blocked,
    remediation: [
      `Add "${metadata.name}" to install.minimumReleaseAgeExcludes in bunfig.toml, or lower ${policy.sourceDescription}.`,
    ],
  });
}

function blockedCandidates(
  metadata: RegistryMetadata,
  spec: string
): { version: string; publishedAt: string }[] {
  const matching = valid(spec)
    ? [spec]
    : metadata.versions.filter((v) => {
        try {
          // Same release/prerelease split bun applies in its resolver.
          return satisfies(v, spec);
        } catch {
          return false;
        }
      });
  return blockedVersionsFrom(metadata, matching);
}
