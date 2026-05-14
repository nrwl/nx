// TODO(v24): Remove this file along with the `'self'` / `'dependencies'`
// magic-string branch in `normalizeTargetDependencyWithStringProjects`. The
// v16 `update-depends-on-to-tokens` migration already rewrites these to the
// modern shape, and `nx repair` will re-run it on demand.
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { readSourceMapsCache } from '../project-graph/nx-deps-cache';
import { readArrayItemSourceInfo } from '../project-graph/utils/project-configuration/source-maps';
import { output } from '../utils/output';

type LegacyValue = 'self' | 'dependencies';
type LegacyEntry = TargetDependencyConfig & { projects: LegacyValue };

export interface LegacyDependsOnViolation {
  index: number;
  // Snapshot before normalization rewrites `projects`/`dependencies`.
  originalEntry: LegacyEntry;
}

export interface LegacyDependsOnLocation {
  ownerTarget?: string;
  index?: number;
  legacyViolations?: LegacyDependsOnViolation[];
}

const warned = new Set<string>();
const isInternal = (p: string | undefined) => !p || p.startsWith('nx/');

// Callers gate this on `dependencyConfig.projects` already being a legacy value;
// the inner cast snapshots that runtime guarantee into the type system.
export function warnLegacyDependsOnMagicString(
  currentProject: string | undefined,
  dependencyConfig: TargetDependencyConfig,
  location: LegacyDependsOnLocation | undefined
): void {
  const violation: LegacyDependsOnViolation = {
    index: location?.index ?? -1,
    originalEntry: { ...dependencyConfig } as LegacyEntry,
  };
  // Collector-aware caller (`getDependencyConfigs`) batches violations so the
  // warning can group all offending entries for a single target. External
  // callers fall through to an immediate per-entry warning.
  if (location?.legacyViolations)
    return void location.legacyViolations.push(violation);
  flushLegacyDependsOnViolations(
    currentProject ?? '<unknown>',
    location?.ownerTarget ?? '<unknown>',
    [violation],
    undefined
  );
}

export function flushLegacyDependsOnViolations(
  project: string,
  ownerTarget: string,
  violations: LegacyDependsOnViolation[],
  projectRoot: string | undefined
): void {
  if (violations.length === 0) return;

  // Read source maps fresh each flush so daemon-cached maps don't go stale;
  // only runs when violations exist, which is rare.
  let sourceMaps: ReturnType<typeof readSourceMapsCache> = null;
  try {
    sourceMaps = readSourceMapsCache();
  } catch {} // best-effort context
  const map = projectRoot && sourceMaps ? sourceMaps[projectRoot] : undefined;
  const arrayKey = `targets.${ownerTarget}.dependsOn`;
  const items = violations.map((v) => {
    const info = map
      ? readArrayItemSourceInfo(map, arrayKey, v.index)
      : undefined;
    return {
      ...v,
      value: v.originalEntry.projects,
      plugin: info?.[1],
      file: info?.[0] ?? undefined,
    };
  });
  type Item = (typeof items)[number];

  const shared = <K extends keyof Item>(key: K): Item[K] | null =>
    items.every((i) => i[key] === items[0][key]) ? items[0][key] : null;
  const value = shared('value');
  const plugin = shared('plugin');
  const file = shared('file');

  // External-plugin warnings are workspace-wide (the plugin's behavior, not a
  // specific config): dedupe per (plugin, value) so the user sees one warning
  // per offending plugin, not one per affected target.
  const dedupeKey =
    plugin && !isInternal(plugin) && value
      ? `plugin::${plugin}::${value}`
      : `target::${project}::${ownerTarget}`;
  if (warned.has(dedupeKey)) return;
  warned.add(dedupeKey);

  const n = items.length;
  const word = n === 1 ? 'entry' : 'entries';
  const deprecation = 'This is deprecated and will be removed in Nx v24 —';
  let phrase: string;
  if (value) {
    phrase = `projects: '${value}'`;
  } else {
    const self = items.filter((i) => i.value === 'self').length;
    phrase = `legacy projects values (${self} 'self', ${n - self} 'dependencies')`;
  }

  let title: string;
  let suppressBody = false;
  if (plugin && !isInternal(plugin)) {
    // Single external plugin: same plugin emits the same value across projects.
    title = `The ${plugin} plugin infers dependsOn entries using ${phrase}. ${deprecation} please upgrade ${plugin} to a version that doesn't emit this.`;
    suppressBody = true;
  } else if (plugin && isInternal(plugin) && file) {
    // Single hand-authored config file — lead with the file path.
    title = `${file} defines ${project}:${ownerTarget} with ${n} dependsOn ${word} using ${phrase}. ${deprecation} run 'nx repair' to fix this.`;
  } else {
    // Mixed sources or no source-map info — tailor advice to what's offending.
    const offending = Array.from(
      new Set(
        items
          .filter((i) => i.plugin && !isInternal(i.plugin))
          .map((i) => i.plugin!)
      )
    );
    const origin = plugin
      ? ` (set by ${plugin}${file ? ` in ${file}` : ''})`
      : '';
    const advice = offending.length
      ? `run 'nx repair' for hand-authored entries and upgrade ${offending.join(', ')} for plugin-inferred entries`
      : `run 'nx repair' to fix`;
    title = `${project}:${ownerTarget} has ${n} dependsOn ${word} using ${phrase}${origin}. ${deprecation} ${advice}.`;
  }

  const bodyLines = suppressBody
    ? []
    : items.map((i) => {
        const src =
          i.plugin && !plugin
            ? ` from ${i.plugin}${i.file ? ` in ${i.file}` : ''}`
            : '';
        return `  - ${JSON.stringify(i.originalEntry)} (${i.index}${src})`;
      });
  output.warn({ title, bodyLines });
}

// Test-only: clears the process-wide dedupe set.
export function __resetForTests(): void {
  warned.clear();
}
