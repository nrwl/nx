import type { PackageManager } from '../package-manager';

// A version held back by the gate, with its raw ISO publish time (from the
// registry `time` map). Shared by the error payload and the per-PM pick code.
export interface BlockedVersion {
  version: string;
  publishedAt: string;
}

export interface MinReleaseAgeViolationErrorOptions {
  packageManager: PackageManager;
  packageName: string;
  spec: string;
  // PM-shaped headline, e.g. npm ETARGET text or pnpm NO_MATURE text
  pmShapedDetail: string;
  // newest blocked candidates with publish times, for prompts/messages
  blocked: BlockedVersion[];
  // per-PM exclude grammar hint; npm: wait or lower window
  remediation: string[];
}

/**
 * Raised when the user's package manager, at its detected version, would refuse
 * to resolve a version because it falls inside the minimum-release-age window.
 * Carries the PM-shaped detail and the blocked candidates so the migrate layer
 * can surface a friendly message or a PM-specific prompt.
 */
export class MinReleaseAgeViolationError extends Error {
  readonly packageManager: PackageManager;
  readonly packageName: string;
  readonly spec: string;
  readonly pmShapedDetail: string;
  readonly blocked: BlockedVersion[];
  readonly remediation: string[];

  constructor(opts: MinReleaseAgeViolationErrorOptions) {
    super(opts.pmShapedDetail);
    this.name = 'MinReleaseAgeViolationError';
    this.packageManager = opts.packageManager;
    this.packageName = opts.packageName;
    this.spec = opts.spec;
    this.pmShapedDetail = opts.pmShapedDetail;
    this.blocked = opts.blocked;
    this.remediation = opts.remediation;
  }
}
