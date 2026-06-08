import { gte, valid } from 'semver';
import {
  detectPackageManager,
  getPackageManagerVersion,
  type PackageManager,
} from '../package-manager';
import { workspaceRoot } from '../workspace-root';
import { readBunPolicy } from './behavior/bun';
import { readNpmPolicy } from './behavior/npm';
import { readPnpmPolicy } from './behavior/pnpm';
import { readYarnPolicy } from './behavior/yarn';

export type MinReleaseAgePolicyReadResult =
  // gate is on; callers must run resolutions through the policy
  | { outcome: 'active'; policy: MinReleaseAgePolicy }
  // no gate -> callers keep the existing fast path
  | { outcome: 'inactive' }
  // callers fall back to PM-install resolution
  | { outcome: 'ambiguous'; reason: string };

export interface MinReleaseAgePolicy {
  packageManagerVersion: string;
  // epoch ms; a version with time[v] <= cutoffMs passes
  cutoffMs: number;
  windowMs: number;
  // human-readable for messaging, e.g. "pnpm minimumReleaseAge (1440 min, default)"
  sourceDescription: string;
  isExcluded(packageName: string, version: string): boolean;
  behavior: PmMinReleaseAgeBehavior;
}

// Discriminated union; per-PM pick/error semantics key off this.
export type PmMinReleaseAgeBehavior =
  | { packageManager: 'npm' }
  | {
      packageManager: 'pnpm';
      strict: boolean;
      // v11 loose fallback: no mature match -> lowest (least-immature) version
      looseFallback: boolean;
      latestTagDegrade: 'same-major' | 'any-major';
      // >=11.1.3: pnpm itself writes excludes / prompts; nx mirrors that
      writesExcludes: boolean;
      missingTimeMap: 'error' | 'skip';
    }
  | { packageManager: 'yarn'; missingVersionTime: 'pass' | 'quarantine' }
  | { packageManager: 'bun' };

// Lowest PM version that ships the cooldown feature; below it the gate is inert.
const INTRODUCED: Record<PackageManager, string> = {
  npm: '11.10.0',
  pnpm: '10.16.0',
  yarn: '4.10.0',
  bun: '1.3.0',
};

/**
 * Reads the package manager, its version, and the relevant cooldown config
 * surfaces once, then dispatches to the per-PM reader. PM versions below the
 * feature's introduction boundary short-circuit to 'inactive' without touching
 * any config surface.
 */
export async function readMinReleaseAgePolicy(
  root: string = workspaceRoot
): Promise<MinReleaseAgePolicyReadResult> {
  const packageManager = detectPackageManager(root);

  let pmVersion: string;
  try {
    pmVersion = getPackageManagerVersion(packageManager, root);
  } catch {
    // Can't determine the version -> can't reason about the gate; let callers
    // fall back to a real PM install which will apply the right behavior.
    return {
      outcome: 'ambiguous',
      reason: `Unable to determine the ${packageManager} version.`,
    };
  }

  if (!valid(pmVersion)) {
    // A non-semver version string can't be reasoned about (gte would throw);
    // defer to a real PM install rather than guess.
    return {
      outcome: 'ambiguous',
      reason: `Unable to parse the ${packageManager} version "${pmVersion}".`,
    };
  }

  if (!gte(pmVersion, INTRODUCED[packageManager])) {
    return { outcome: 'inactive' };
  }

  switch (packageManager) {
    case 'npm':
      return readNpmPolicy(root, pmVersion);
    case 'pnpm':
      return readPnpmPolicy(root, pmVersion);
    case 'yarn':
      return readYarnPolicy(root, pmVersion);
    case 'bun':
      return readBunPolicy(root, pmVersion);
  }
}
