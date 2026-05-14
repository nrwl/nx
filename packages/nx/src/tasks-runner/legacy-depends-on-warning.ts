// TODO(v24): Remove this file along with the `'self'` / `'dependencies'`
// magic-string branch in `normalizeTargetDependencyWithStringProjects`. The
// v16 `update-depends-on-to-tokens` migration already rewrites these to the
// modern shape, and `nx repair` will re-run it on demand.
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { readSourceMapsCache } from '../project-graph/nx-deps-cache';
import { readArrayItemSourceInfo } from '../project-graph/utils/project-configuration/source-maps';
import { output } from '../utils/output';

export interface LegacyDependsOnViolation {
  index: number;
  // Snapshot of the entry as authored, before normalization rewrites
  // `projects` / `dependencies`. Used to display the user-facing form.
  originalEntry: TargetDependencyConfig & {
    projects: 'self' | 'dependencies';
  };
}

export interface LegacyDependsOnLocation {
  ownerTarget?: string;
  index?: number;
  legacyViolations?: LegacyDependsOnViolation[];
}

export function warnLegacyDependsOnMagicString(
  currentProject: string | undefined,
  dependencyConfig: TargetDependencyConfig & {
    projects: 'self' | 'dependencies';
  },
  location: LegacyDependsOnLocation | undefined
): void {
  const violation: LegacyDependsOnViolation = {
    index: location?.index ?? -1,
    originalEntry: { ...dependencyConfig },
  };
  // Collector-aware caller (`getDependencyConfigs`) batches violations so the
  // warning can group all offending entries for a single target. External
  // callers without a collector fall through to an immediate per-entry warning.
  if (location?.legacyViolations) {
    location.legacyViolations.push(violation);
    return;
  }
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
  const annotated = annotateLegacyViolations(
    ownerTarget,
    projectRoot,
    violations
  );
  const { sharedValue, sharedPlugin, sharedFile } =
    computeSharedFields(annotated);
  // External-plugin warnings are workspace-wide (the plugin's behavior, not a
  // specific config): dedupe per (plugin, value) so the user sees one warning
  // per offending plugin, not one per affected target.
  const dedupeKey =
    sharedPlugin && !isInternalPlugin(sharedPlugin) && sharedValue
      ? `plugin::${sharedPlugin}::${sharedValue}`
      : `target::${project}::${ownerTarget}`;
  if (warnedLegacyDependsOnMagicStrings.has(dedupeKey)) return;
  warnedLegacyDependsOnMagicStrings.add(dedupeKey);

  const { title, suppressBody } = buildLegacyDependsOnWarning(
    project,
    ownerTarget,
    annotated,
    { sharedValue, sharedPlugin, sharedFile }
  );
  const bodyLines = suppressBody
    ? []
    : annotated.map((v) => formatLegacyDependsOnBodyLine(v, sharedPlugin));

  output.warn({ title, bodyLines });
}

// Test-only: clears the process-wide dedupe set so each test sees a fresh
// emission state.
export function __resetForTests(): void {
  warnedLegacyDependsOnMagicStrings.clear();
}

const warnedLegacyDependsOnMagicStrings = new Set<string>();

interface AnnotatedLegacyDependsOnViolation extends LegacyDependsOnViolation {
  value: 'self' | 'dependencies';
  plugin?: string;
  file?: string;
}

function isInternalPlugin(plugin: string | undefined): boolean {
  return !plugin || plugin.startsWith('nx/');
}

function annotateLegacyViolations(
  ownerTarget: string,
  projectRoot: string | undefined,
  violations: LegacyDependsOnViolation[]
): AnnotatedLegacyDependsOnViolation[] {
  // Read fresh each flush so daemon-cached source maps don't go stale across
  // graph rebuilds. Flush is gated on having violations, so this only runs on
  // a workspace that actually still has legacy values.
  let sourceMaps: ReturnType<typeof readSourceMapsCache> = null;
  try {
    sourceMaps = readSourceMapsCache();
  } catch {
    // Source maps are best-effort context for the warning; absence is fine.
  }
  const projectSourceMap =
    projectRoot && sourceMaps ? sourceMaps[projectRoot] : undefined;
  const dependsOnKey = `targets.${ownerTarget}.dependsOn`;
  return violations.map((v) => {
    const sourceInfo = projectSourceMap
      ? readArrayItemSourceInfo(projectSourceMap, dependsOnKey, v.index)
      : undefined;
    return {
      ...v,
      value: v.originalEntry.projects,
      plugin: sourceInfo?.[1],
      file: sourceInfo?.[0] ?? undefined,
    };
  });
}

// Single pass over the annotated violations to find any field that's
// uniform across every entry (or `null` if values differ).
function computeSharedFields(annotated: AnnotatedLegacyDependsOnViolation[]): {
  sharedValue: 'self' | 'dependencies' | null;
  sharedPlugin: string | undefined | null;
  sharedFile: string | undefined | null;
} {
  const first = annotated[0];
  let sharedValue: 'self' | 'dependencies' | null = first.value;
  let sharedPlugin: string | undefined | null = first.plugin;
  let sharedFile: string | undefined | null = first.file;
  for (let i = 1; i < annotated.length; i++) {
    const v = annotated[i];
    if (sharedValue !== null && v.value !== sharedValue) sharedValue = null;
    if (sharedPlugin !== null && v.plugin !== sharedPlugin) sharedPlugin = null;
    if (sharedFile !== null && v.file !== sharedFile) sharedFile = null;
  }
  return { sharedValue, sharedPlugin, sharedFile };
}

function describeLegacyValuePhrase(
  annotated: AnnotatedLegacyDependsOnViolation[],
  sharedValue: 'self' | 'dependencies' | null
): string {
  if (sharedValue) return `projects: '${sharedValue}'`;
  const selfCount = annotated.filter((v) => v.value === 'self').length;
  const depCount = annotated.length - selfCount;
  return `legacy projects values (${selfCount} 'self', ${depCount} 'dependencies')`;
}

function buildLegacyDependsOnWarning(
  project: string,
  ownerTarget: string,
  annotated: AnnotatedLegacyDependsOnViolation[],
  shared: {
    sharedValue: 'self' | 'dependencies' | null;
    sharedPlugin: string | undefined | null;
    sharedFile: string | undefined | null;
  }
): { title: string; suppressBody: boolean } {
  const { sharedPlugin, sharedFile, sharedValue } = shared;
  const valuePhrase = describeLegacyValuePhrase(annotated, sharedValue);
  const entryWord = annotated.length === 1 ? 'entry' : 'entries';
  const deprecation = 'This is deprecated and will be removed in Nx v24 —';

  // Single external plugin: the same plugin typically emits the same legacy
  // value on every project it touches, so a single workspace-wide warning is
  // more useful than one per target.
  if (sharedPlugin && !isInternalPlugin(sharedPlugin)) {
    return {
      title: `The ${sharedPlugin} plugin infers dependsOn entries using ${valuePhrase}. ${deprecation} please upgrade ${sharedPlugin} to a version that doesn't emit this.`,
      suppressBody: true,
    };
  }

  // Single hand-authored config file — lead with the file path.
  if (sharedPlugin && isInternalPlugin(sharedPlugin) && sharedFile) {
    return {
      title: `${sharedFile} defines ${project}:${ownerTarget} with ${annotated.length} dependsOn ${entryWord} using ${valuePhrase}. ${deprecation} run 'nx repair' to fix this.`,
      suppressBody: false,
    };
  }

  // Mixed sources, or no source-map info — tailor advice to what's offending.
  const offendingPlugins = Array.from(
    new Set(
      annotated
        .filter((v) => v.plugin && !isInternalPlugin(v.plugin))
        .map((v) => v.plugin as string)
    )
  );
  const origin = sharedPlugin
    ? ` (set by ${sharedPlugin}${sharedFile ? ` in ${sharedFile}` : ''})`
    : '';
  const advice = offendingPlugins.length
    ? `run 'nx repair' for hand-authored entries and upgrade ${offendingPlugins.join(', ')} for plugin-inferred entries`
    : `run 'nx repair' to fix`;
  return {
    title: `${project}:${ownerTarget} has ${annotated.length} dependsOn ${entryWord} using ${valuePhrase}${origin}. ${deprecation} ${advice}.`,
    suppressBody: false,
  };
}

function formatLegacyDependsOnBodyLine(
  v: AnnotatedLegacyDependsOnViolation,
  sharedPlugin: string | undefined | null
): string {
  const showSource = v.plugin && !sharedPlugin;
  const sourcePart = showSource
    ? ` from ${v.plugin}${v.file ? ` in ${v.file}` : ''}`
    : '';
  return `  - ${JSON.stringify(v.originalEntry)} (${v.index}${sourcePart})`;
}
