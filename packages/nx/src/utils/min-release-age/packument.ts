import { packageRegistryView } from '../package-manager';

export interface RegistryMetadata {
  name: string;
  versions: string[];
  // null when the registry serves no time map (third-party registries)
  time: Record<string, string> | null;
  distTags: Record<string, string>;
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
