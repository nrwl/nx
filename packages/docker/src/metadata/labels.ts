import { RepoContext, ResolvedVersion } from './types';

function mergeKeyValueEntries(entries: string[]): string[] {
  const parsed = entries
    .map((entry) => entry.split('='))
    .filter(([, ...values]) => values.length > 0)
    .map(([key, ...values]) => [key, values.join('=')] as [string, string]);

  return Array.from(new Map(parsed))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`);
}

/**
 * Builds the default `org.opencontainers.image.*` OCI labels from a (best-effort, local)
 * `RepoContext`, merged with custom labels. Later entries win on key collision (custom labels
 * override the generated defaults), matching the original's `Map`-based dedup semantics.
 */
export function buildOciLabels(
  repo: RepoContext,
  version: ResolvedVersion,
  sha: string | undefined,
  now: Date,
  extra: string[]
): string[] {
  const defaults = [
    `org.opencontainers.image.title=${repo.name || ''}`,
    `org.opencontainers.image.description=${repo.description || ''}`,
    `org.opencontainers.image.url=${repo.url || ''}`,
    `org.opencontainers.image.source=${repo.url || ''}`,
    `org.opencontainers.image.version=${version.main || ''}`,
    `org.opencontainers.image.created=${now.toISOString()}`,
    `org.opencontainers.image.revision=${sha || ''}`,
    `org.opencontainers.image.licenses=${repo.license || ''}`,
  ];
  return mergeKeyValueEntries([...defaults, ...extra]);
}

export function buildAnnotations(
  repo: RepoContext,
  version: ResolvedVersion,
  sha: string | undefined,
  now: Date,
  extra: string[]
): string[] {
  return buildOciLabels(repo, version, sha, now, extra);
}
