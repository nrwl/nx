// TODO(v24): Remove this file along with the `'self'` / `'dependencies'`
// magic-string branch in `normalizeTargetDependencyWithStringProjects`. The
// v16 `update-depends-on-to-tokens` migration already rewrites these to the
// modern shape, and `nx repair` will re-run it on demand.
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { readSourceMapsCache } from '../project-graph/nx-deps-cache';
import { ConfigurationSourceMaps } from '../project-graph/utils/project-configuration/source-maps';
import { output } from '../utils/output';

export interface LegacyDependsOnViolation {
  value: 'self' | 'dependencies';
  index: number;
  // Snapshot of the entry as authored, before normalization rewrites
  // `projects` / `dependencies`. Used to display the user-facing form.
  originalEntry: TargetDependencyConfig;
}

export interface LegacyDependsOnLocation {
  ownerTarget?: string;
  index?: number;
  legacyViolations?: LegacyDependsOnViolation[];
}

export function warnLegacyDependsOnMagicString(
  value: 'self' | 'dependencies',
  currentProject: string | undefined,
  dependencyConfig: TargetDependencyConfig,
  location: LegacyDependsOnLocation | undefined
): void {
  const violation: LegacyDependsOnViolation = {
    value,
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
  const sharedPlugin = sharedField(annotated, 'plugin');
  // External-plugin warnings are workspace-wide (the plugin's behavior, not a
  // specific config): dedupe per (plugin, value) so the user sees one warning
  // per offending plugin, not one per affected target.
  const sharedValue = sharedField(annotated, 'value');
  const dedupeKey =
    sharedPlugin && !isInternalPlugin(sharedPlugin) && sharedValue
      ? `plugin::${sharedPlugin}::${sharedValue}`
      : `target::${project}::${ownerTarget}`;
  if (warnedLegacyDependsOnMagicStrings.has(dedupeKey)) return;
  warnedLegacyDependsOnMagicStrings.add(dedupeKey);

  const { title, suppressBody } = buildLegacyDependsOnWarning(
    project,
    ownerTarget,
    annotated
  );
  const bodyLines = suppressBody
    ? []
    : annotated.map((v) => formatLegacyDependsOnBodyLine(v, sharedPlugin));

  output.warn({ title, bodyLines });
}

const warnedLegacyDependsOnMagicStrings = new Set<string>();

let cachedSourceMaps: ConfigurationSourceMaps | null | undefined = undefined;
function getSourceMapsLazy(): ConfigurationSourceMaps | null {
  if (cachedSourceMaps !== undefined) return cachedSourceMaps;
  try {
    cachedSourceMaps = readSourceMapsCache();
  } catch {
    cachedSourceMaps = null;
  }
  return cachedSourceMaps;
}

interface AnnotatedLegacyDependsOnViolation extends LegacyDependsOnViolation {
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
  const sourceMaps = getSourceMapsLazy();
  const projectSourceMap =
    projectRoot && sourceMaps ? sourceMaps[projectRoot] : undefined;
  return violations.map((v) => {
    const sourceInfo =
      projectSourceMap?.[`targets.${ownerTarget}.dependsOn.${v.index}`] ??
      projectSourceMap?.[`targets.${ownerTarget}.dependsOn`];
    return {
      ...v,
      plugin: sourceInfo?.[1],
      file: sourceInfo?.[0] ?? undefined,
    };
  });
}

// Returns the value shared by every annotated violation, or `null` if values
// differ. Used to collapse repeated information into the title.
function sharedField<T, K extends keyof T>(items: T[], key: K): T[K] | null {
  const first = items[0][key];
  return items.every((item) => item[key] === first) ? first : null;
}

function describeLegacyValuePhrase(
  annotated: AnnotatedLegacyDependsOnViolation[]
): string {
  const sharedValue = sharedField(annotated, 'value');
  if (sharedValue) return `projects: '${sharedValue}'`;
  const selfCount = annotated.filter((v) => v.value === 'self').length;
  const depCount = annotated.length - selfCount;
  return `legacy projects values (${selfCount} 'self', ${depCount} 'dependencies')`;
}

function buildLegacyDependsOnWarning(
  project: string,
  ownerTarget: string,
  annotated: AnnotatedLegacyDependsOnViolation[]
): { title: string; suppressBody: boolean } {
  const sharedPlugin = sharedField(annotated, 'plugin');
  const sharedFile = sharedField(annotated, 'file');
  const valuePhrase = describeLegacyValuePhrase(annotated);
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
  sharedPlugin: string | null
): string {
  const showSource = v.plugin && !sharedPlugin;
  const sourcePart = showSource
    ? ` from ${v.plugin}${v.file ? ` in ${v.file}` : ''}`
    : '';
  return `  - ${JSON.stringify(v.originalEntry)} (${v.index}${sourcePart})`;
}
