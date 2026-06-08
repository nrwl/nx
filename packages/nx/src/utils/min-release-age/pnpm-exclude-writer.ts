import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Document, parseDocument, Scalar, YAMLMap, YAMLSeq } from 'yaml';

const EXCLUDE_KEY = 'minimumReleaseAgeExclude';

/**
 * Appends `<name>@<version>` entries to `minimumReleaseAgeExclude` in
 * pnpm-workspace.yaml, mirroring what pnpm's loose-mode policy handler writes at
 * install time (deduped, existing order preserved, new entries appended). The
 * edit is comment-preserving (yaml document API); the file is created when
 * absent. Returns the entries that were newly added (empty when all were
 * already present or `entries` is empty).
 *
 * Each entry must already be in `<name>@<version>` form. The caller is
 * responsible for building it from the resolved package name and version.
 */
export function appendMinimumReleaseAgeExcludes(
  root: string,
  entries: string[]
): string[] {
  const deduped = [...new Set(entries)].filter(Boolean);
  if (deduped.length === 0) {
    return [];
  }

  const path = join(root, 'pnpm-workspace.yaml');
  const raw = existsSync(path) ? readFileSync(path, 'utf-8') : '';
  // An empty/whitespace-only or non-mapping file gives null contents; reset to a
  // fresh mapping document so the exclude key has somewhere to land.
  const parsed = parseDocument(raw);
  const doc =
    parsed.contents instanceof YAMLMap ? parsed : new Document(new YAMLMap());

  const seq = doc.get(EXCLUDE_KEY);
  const existingSeq = seq instanceof YAMLSeq ? seq : undefined;
  const existing = new Set(seqStringValues(existingSeq));
  const added = deduped.filter((entry) => !existing.has(entry));
  if (added.length === 0) {
    return [];
  }

  if (existingSeq) {
    for (const entry of added) {
      existingSeq.add(entry);
    }
  } else {
    doc.set(EXCLUDE_KEY, added);
  }

  writeFileSync(path, doc.toString());
  return added;
}

function seqStringValues(seq: YAMLSeq | undefined): string[] {
  if (!seq) {
    return [];
  }
  return seq.items.map((item) =>
    item instanceof Scalar ? String(item.value) : String(item)
  );
}
