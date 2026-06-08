import { packageRegistryView } from '../package-manager';

export interface RegistryMetadata {
  name: string;
  versions: string[];
  // null when the registry serves no time map (third-party registries)
  time: Record<string, string> | null;
  distTags: Record<string, string>;
  // populated lazily (via fetchDeprecations) only for the pnpm >=10.20
  // any-major latest-tag degrade, which prefers a non-deprecated candidate
  deprecations?: Record<string, string | true>;
}

// `npm view <pkg> --json` collapses single-element fields to scalars.
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Fetches the full packument for a package and normalizes the quirks of
 * `npm view --json`: `versions` may be a scalar when a single version exists,
 * `time` may be absent (third-party registries) and is exposed as null,
 * `dist-tags` carries a hyphen.
 */
export async function fetchRegistryMetadata(
  pkg: string
): Promise<RegistryMetadata> {
  const raw = await packageRegistryView(pkg, '', '--json');
  const parsed = JSON.parse(raw) as {
    name?: string;
    versions?: string | string[];
    time?: Record<string, string>;
    'dist-tags'?: Record<string, string>;
  };

  const time = parsed.time ?? null;
  if (time) {
    // The time map carries 'created'/'modified' alongside versions; they are
    // harmless to keep but never referenced as versions.
    delete (time as Record<string, string>).created;
    delete (time as Record<string, string>).modified;
  }

  return {
    name: parsed.name ?? pkg,
    versions: toArray(parsed.versions),
    time,
    distTags: parsed['dist-tags'] ?? {},
  };
}

/**
 * Fetches the deprecation map for a package, keyed by version. Lazy: only the
 * pnpm >=10.20 latest-tag any-major degrade path needs it.
 */
export async function fetchDeprecations(
  pkg: string
): Promise<Record<string, string | true>> {
  const raw = await packageRegistryView(pkg, '', 'deprecated --json');
  if (!raw) {
    return {};
  }
  const parsed = JSON.parse(raw) as Record<string, string | true> | string;
  // A single-version package yields a scalar (the message or empty string).
  return typeof parsed === 'object' && parsed !== null ? parsed : {};
}
