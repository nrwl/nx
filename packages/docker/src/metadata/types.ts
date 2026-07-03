export type TagType =
  | 'schedule'
  | 'semver'
  | 'pep440'
  | 'match'
  | 'edge'
  | 'ref'
  | 'raw'
  | 'sha';

export type RefEvent = 'branch' | 'tag' | 'pr';

export type ShaFormat = 'short' | 'long';

export interface ParsedTag {
  type: TagType;
  attrs: Record<string, string>;
}

export const DEFAULT_TAG_PRIORITIES: Record<TagType, string> = {
  schedule: '1000',
  semver: '900',
  pep440: '900',
  match: '800',
  edge: '700',
  ref: '600',
  raw: '200',
  sha: '100',
};

export interface ParsedImage {
  name: string;
  enable: boolean;
}

export interface ParsedFlavor {
  latest: 'auto' | 'true' | 'false';
  prefix: string;
  prefixLatest: boolean;
  suffix: string;
  suffixLatest: boolean;
}

export interface ResolvedVersion {
  main: string | undefined;
  partial: string[];
  latest: boolean;
}

/**
 * Minimal, engine/CI-agnostic ref context the tag algorithm needs. Deliberately shaped like a
 * GitHub Actions ref ("refs/heads/x", "refs/tags/x", "refs/pull/n/merge") so the ported
 * regex-matching logic in version-resolver.ts needs no changes from the original algorithm.
 */
export interface GitRefContext {
  ref: string;
  sha: string | undefined;
  isDefaultBranch: boolean;
  /**
   * Mirrors the GitHub Actions "event name" (e.g. 'schedule', 'push', 'pull_request') that gates
   * the `schedule` tag type in the original implementation. There is no local-git equivalent, so
   * this defaults to `''` (inert) unless explicitly provided via the `NX_DOCKER_METADATA_EVENT`
   * env var — without it, a `type=schedule` rule (including the one in the default tag set) never
   * fires, matching the safe default behavior outside of an actual scheduled/cron trigger.
   */
  eventName: string;
}

export interface RepoContext {
  name: string;
  description: string;
  url: string;
  defaultBranch: string;
  license: string | undefined;
}

export interface ContainerMetadataOptions {
  images: string[];
  tags: string[];
  flavor: string[];
  labels: string[];
  annotations: string[];
}

export interface ContainerMetadataResult {
  version: ResolvedVersion;
  tags: string[];
  labels: string[];
  annotations: string[];
}
