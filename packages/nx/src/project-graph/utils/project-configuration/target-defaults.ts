import { minimatch } from 'minimatch';
import {
  NormalizedTargetDefaults,
  NxJsonConfiguration,
  TargetDefaultEntry,
  TargetDefaults,
  TargetDefaultsRecord,
} from '../../../config/nx-json';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../../config/workspace-json-project-json';
import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import { findMatchingProjects } from '../../../utils/find-matching-projects';
import { isGlobPattern } from '../../../utils/globs';
import type { CreateNodesResult } from '../../plugins/public-api';
import {
  SourceInformation,
  ConfigurationSourceMaps,
  targetOptionSourceMapKey,
} from './source-maps';
import {
  deepClone,
  isCompatibleTarget,
  resolveCommandSyntacticSugar,
} from './target-merging';
import { uniqueKeysInObjects } from './utils';
import { EOL } from 'os';
import * as pc from 'picocolors';

type CreateNodesResultEntry = readonly [
  plugin: string,
  file: string,
  result: CreateNodesResult,
  pluginIndex?: number,
];

/**
 * Builds a synthetic plugin result from nx.json's `targetDefaults`, layered
 * between specified-plugin and default-plugin results during merging.
 */
export function createTargetDefaultsResults(
  specifiedPluginRootMap: Record<string, ProjectConfiguration>,
  defaultPluginRootMap: Record<string, ProjectConfiguration>,
  nxJsonConfiguration: NxJsonConfiguration,
  specifiedSourceMaps?: ConfigurationSourceMaps,
  defaultSourceMaps?: ConfigurationSourceMaps
): CreateNodesResultEntry[] {
  const targetDefaultsConfig = nxJsonConfiguration.targetDefaults;
  if (!targetDefaultsConfig) {
    return [];
  }

  const entries = normalizeTargetDefaults(targetDefaultsConfig);
  if (entries.length === 0) {
    return [];
  }

  const projectNodesByName = buildProjectNodesByName(
    specifiedPluginRootMap,
    defaultPluginRootMap
  );
  const rootToName = new Map<string, string>();
  for (const [name, node] of Object.entries(projectNodesByName)) {
    rootToName.set(node.data.root, name);
  }

  const syntheticProjects: Record<string, ProjectConfiguration> = {};

  const allRoots = new Set<string>([
    ...Object.keys(specifiedPluginRootMap),
    ...Object.keys(defaultPluginRootMap),
  ]);

  for (const root of allRoots) {
    const specifiedTargets = specifiedPluginRootMap[root]?.targets ?? {};
    const defaultTargets = defaultPluginRootMap[root]?.targets ?? {};
    const projectName = rootToName.get(root);
    const projectNode = projectName
      ? projectNodesByName[projectName]
      : undefined;

    for (const targetName of uniqueKeysInObjects(
      specifiedTargets,
      defaultTargets
    )) {
      const sourcePlugin = resolveSourcePlugin(
        root,
        targetName,
        specifiedSourceMaps,
        defaultSourceMaps
      );

      const syntheticTarget = buildSyntheticTargetForRoot(
        targetName,
        root,
        specifiedTargets[targetName],
        defaultTargets[targetName],
        entries,
        projectName,
        projectNode,
        sourcePlugin
      );

      if (!syntheticTarget) continue;

      syntheticProjects[root] ??= { root, targets: {} };
      syntheticProjects[root].targets[targetName] = syntheticTarget;
    }
  }

  if (Object.keys(syntheticProjects).length === 0) {
    return [];
  }

  return [
    [
      'nx/target-defaults',
      'nx.json',
      {
        projects: syntheticProjects,
      },
    ],
  ];
}

// Returns the synthetic defaults target to insert for `targetName` at
// `root`, or undefined if no defaults apply.
// Layering: specified plugins < target defaults < default plugins.
function buildSyntheticTargetForRoot(
  targetName: string,
  root: string,
  specifiedTarget: TargetConfiguration | undefined,
  defaultTarget: TargetConfiguration | undefined,
  entries: NormalizedTargetDefaults,
  projectName: string | undefined,
  projectNode: ProjectGraphProjectNode | undefined,
  sourcePlugin: string | undefined
): TargetConfiguration | undefined {
  const resolvedSpecified = specifiedTarget
    ? resolveCommandSyntacticSugar(specifiedTarget, root)
    : undefined;
  const resolvedDefault = defaultTarget
    ? resolveCommandSyntacticSugar(defaultTarget, root)
    : undefined;

  // Specified-only: layer defaults on top, but only when the resulting
  // synthetic is compatible with the specified target. An incompatible
  // synthetic (e.g. an entry with `executor: '@monodon/rust:test'` while
  // a polyglot plugin infers the same target with `nx:run-commands`)
  // would otherwise replace the specified target wholesale during the
  // downstream merge.
  if (resolvedSpecified && !resolvedDefault) {
    const targetDefaults = readAndPrepareTargetDefaults(
      targetName,
      resolvedSpecified.executor,
      resolvedSpecified.command,
      root,
      entries,
      projectName,
      projectNode,
      sourcePlugin
    );
    if (
      targetDefaults &&
      !isCompatibleTarget(resolvedSpecified, targetDefaults)
    ) {
      return undefined;
    }
    return targetDefaults;
  }

  // Default-only.
  if (resolvedDefault && !resolvedSpecified) {
    return readAndPrepareTargetDefaults(
      targetName,
      resolvedDefault.executor,
      resolvedDefault.command,
      root,
      entries,
      projectName,
      projectNode,
      sourcePlugin
    );
  }

  if (!resolvedSpecified || !resolvedDefault) return undefined;

  // Both compatible: use the default plugin's executor for the lookup.
  // The same incompatibility check applies — a project.json `{}` entry
  // asks defaults to fill in the target, but the lookup can still fall
  // back to a target-name keyed default with a foreign executor that
  // would replace the inferred target. Skip the synthetic in that case.
  if (isCompatibleTarget(resolvedSpecified, resolvedDefault)) {
    const targetDefaults = readAndPrepareTargetDefaults(
      targetName,
      resolvedDefault.executor || resolvedSpecified.executor,
      resolvedDefault.command || resolvedSpecified.command,
      root,
      entries,
      projectName,
      projectNode,
      sourcePlugin
    );
    if (
      targetDefaults &&
      !isCompatibleTarget(resolvedSpecified, targetDefaults)
    ) {
      return undefined;
    }
    return targetDefaults;
  }

  // Incompatible: default plugin will replace specified; only defaults
  // matching the default plugin's executor are useful.
  const targetDefaults = readAndPrepareTargetDefaults(
    targetName,
    resolvedDefault.executor,
    resolvedDefault.command,
    root,
    entries,
    projectName,
    projectNode,
    sourcePlugin
  );
  if (targetDefaults && isCompatibleTarget(resolvedDefault, targetDefaults)) {
    // Stamp executor/command so the default layer merges cleanly on top.
    return {
      ...targetDefaults,
      executor: resolvedDefault.executor,
      command: resolvedDefault.command,
    };
  }

  return undefined;
}

function readAndPrepareTargetDefaults(
  targetName: string,
  executor: string | undefined,
  command: string | undefined,
  root: string,
  entries: NormalizedTargetDefaults,
  projectName: string | undefined,
  projectNode: ProjectGraphProjectNode | undefined,
  sourcePlugin: string | undefined
): TargetConfiguration | undefined {
  const rawTargetDefaults = findBestTargetDefault(
    targetName,
    executor,
    projectName,
    projectNode,
    sourcePlugin,
    entries,
    command
  );
  if (!rawTargetDefaults) return undefined;

  return resolveCommandSyntacticSugar(deepClone(rawTargetDefaults), root);
}

/**
 * Public, backwards-compatible reader that looks up the most-specific
 * target default for a given target. Accepts either the new array shape
 * or the legacy record shape (devkit support).
 *
 * When called without project context, entries that require a `projects`
 * filter or a `source` filter are skipped.
 *
 * The normalized entries are cached per `targetDefaults` reference so
 * repeated reads against the same nx.json don't re-normalize (and don't
 * re-fire the legacy-record-shape warning).
 */
export function readTargetDefaultsForTarget(
  targetName: string,
  targetDefaults: TargetDefaults | undefined,
  executor?: string,
  opts?: {
    projectName?: string;
    projectNode?: ProjectGraphProjectNode;
    sourcePlugin?: string;
    command?: string;
  }
): Partial<TargetConfiguration> | null {
  if (!targetDefaults) return null;
  return findBestTargetDefault(
    targetName,
    executor,
    opts?.projectName,
    opts?.projectNode,
    opts?.sourcePlugin,
    getCachedNormalizedEntries(targetDefaults),
    opts?.command
  );
}

const normalizedEntriesCache = new WeakMap<object, NormalizedTargetDefaults>();

function getCachedNormalizedEntries(
  targetDefaults: TargetDefaults
): NormalizedTargetDefaults {
  // WeakMap keys must be objects — both array and record forms are objects,
  // so this is safe regardless of shape.
  const key = targetDefaults as unknown as object;
  let entries = normalizedEntriesCache.get(key);
  if (!entries) {
    entries = normalizeTargetDefaults(targetDefaults);
    normalizedEntriesCache.set(key, entries);
  }
  return entries;
}

type MatchKind =
  | 'targetAndExecutor'
  | 'executorOnly'
  | 'exactTarget'
  | 'globTarget';

interface Candidate {
  config: Partial<TargetConfiguration>;
  tier: number;
  matchKind: MatchKind;
  index: number;
}

/**
 * Find the highest-specificity `targetDefaults` entry that applies to the
 * given (target, project, sourcePlugin) tuple. Ties are broken by match
 * kind, then by later array index. Returns the config slice with filter
 * keys (`target`, `projects`, `source`) stripped.
 *
 * Tier = 1 (the entry matched) + 1 per applied filter (`projects`,
 * `source`). So:
 *   - tier 3: target/executor + projects + source
 *   - tier 2: target/executor + projects, or target/executor + source
 *   - tier 1: target/executor alone
 *
 * `executor` matching contributes to matchKind only, not to tier — it's
 * not a filter, it's a refinement of the match. Within the same tier,
 * tie-break order (highest first):
 *   targetAndExecutor > executorOnly > exactTarget > globTarget
 *
 * `executor` only acts as an "injector" (matches a target with neither
 * executor nor command) when the entry also sets `target`. Executor-only
 * entries require the workspace target to actually have an executor.
 */
export function findBestTargetDefault(
  targetName: string,
  executor: string | undefined,
  projectName: string | undefined,
  projectNode: ProjectGraphProjectNode | undefined,
  sourcePlugin: string | undefined,
  entries: NormalizedTargetDefaults,
  targetCommand?: string | undefined
): Partial<TargetConfiguration> | null {
  if (!entries?.length) return null;

  let best: Candidate | null = null;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    if (entry.target === undefined && entry.executor === undefined) continue;

    let targetKind: 'exact' | 'glob' | null = null;
    if (entry.target !== undefined) {
      if (entry.target === targetName) targetKind = 'exact';
      else if (
        isGlobPattern(entry.target) &&
        minimatch(targetName, entry.target)
      )
        targetKind = 'glob';
      else continue;
    }

    let executorMatched = false;
    if (entry.executor !== undefined) {
      if (executor && executor === entry.executor) {
        executorMatched = true;
      } else if (targetKind !== null && !executor && !targetCommand) {
        // `executor` injects into a bare target the entry's `target`
        // already matched.
        executorMatched = true;
      } else {
        continue;
      }
    }

    let tier = 1;

    if (entry.projects !== undefined) {
      if (!projectName || !projectNode) continue;
      const patterns = Array.isArray(entry.projects)
        ? entry.projects
        : [entry.projects];
      const matched = findMatchingProjects(patterns, {
        [projectName]: projectNode,
      });
      if (!matched.includes(projectName)) continue;
      tier++;
    }

    if (entry.source !== undefined) {
      if (entry.source !== sourcePlugin) continue;
      tier++;
    }

    const matchKind: MatchKind =
      targetKind !== null && executorMatched
        ? 'targetAndExecutor'
        : targetKind === null
          ? 'executorOnly'
          : targetKind === 'exact'
            ? 'exactTarget'
            : 'globTarget';

    const candidate: Candidate = {
      config: stripFilterKeys(entry),
      tier,
      matchKind,
      index: i,
    };

    if (!best || beats(candidate, best)) {
      best = candidate;
    }
  }

  return best ? best.config : null;
}

function beats(a: Candidate, b: Candidate): boolean {
  if (a.tier !== b.tier) return a.tier > b.tier;
  const aRank = matchKindRank(a.matchKind);
  const bRank = matchKindRank(b.matchKind);
  if (aRank !== bRank) return aRank > bRank;
  // Tie: later array index wins.
  return a.index > b.index;
}

function matchKindRank(kind: MatchKind): number {
  switch (kind) {
    case 'targetAndExecutor':
      return 3;
    case 'executorOnly':
      return 2;
    case 'exactTarget':
      return 1;
    case 'globTarget':
      return 0;
  }
}

function stripFilterKeys(
  entry: TargetDefaultEntry
): Partial<TargetConfiguration> {
  const { target, projects, source, ...rest } = entry;
  return rest;
}

let hasWarnedAboutLegacyRecordShape = false;

/**
 * Accept either the new array shape or the legacy record shape and return
 * a normalized array. Record entries become `{ target: key, ...value }`
 * — except executor-shaped keys (e.g. `@nx/vite:test`, `nx:run-commands`)
 * which become `{ executor: key, ...value }` so the matcher treats them
 * as executor matches rather than target-name matches.
 *
 * When the record shape is encountered we log a one-time warning
 * recommending `nx repair`, which will re-run the migration that
 * converts `targetDefaults` to the array shape.
 */
export function normalizeTargetDefaults(
  raw: TargetDefaults | undefined
): NormalizedTargetDefaults {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  warnAboutLegacyRecordShapeOnce();
  const out: TargetDefaultEntry[] = [];
  for (const key of Object.keys(raw)) {
    const value = (raw as TargetDefaultsRecord)[key] ?? {};
    out.push(
      key.includes(':') && !isGlobPattern(key)
        ? { ...value, executor: key }
        : { ...value, target: key }
    );
  }
  return out;
}

function warnAboutLegacyRecordShapeOnce() {
  if (hasWarnedAboutLegacyRecordShape) return;
  hasWarnedAboutLegacyRecordShape = true;
  // Written to stderr (not stdout) so commands with structured stdout —
  // e.g. `nx show project --json` — remain parseable.
  const title = pc.yellow(
    'NX  nx.json uses the legacy record-shape `targetDefaults`'
  );
  const bodyLines = [
    'The object/record form of `targetDefaults` is deprecated. Nx still reads it for now, but the array form is required to use the new `projects` and `source` filters.',
    'Run `nx repair` to automatically convert `targetDefaults` to the array shape.',
  ];
  process.stderr.write(
    `${EOL}${title}${EOL}${EOL}${bodyLines
      .map((l) => `  ${l}`)
      .join(EOL)}${EOL}${EOL}`
  );
}

/** Test-only: resets the module-level "warned once" flag. */
export function __resetTargetDefaultsLegacyWarning() {
  hasWarnedAboutLegacyRecordShape = false;
}

function resolveSourcePlugin(
  root: string,
  targetName: string,
  specifiedSourceMaps: ConfigurationSourceMaps | undefined,
  defaultSourceMaps: ConfigurationSourceMaps | undefined
): string | undefined {
  // Default plugins (nx's baked-in inference of per-project config files
  // like package.json, tsconfig.json) always overwrite specified-plugin
  // attribution in the merge. Their attribution is what survives, so it
  // takes precedence here when matching `source:` filters.
  //
  // We only consult the executor/command source-map keys — the top-level
  // `targets.<name>` key tracks only the last writer, not the originator,
  // and is unreliable for source attribution.
  const executorKey = targetOptionSourceMapKey(targetName, 'executor');
  const commandKey = targetOptionSourceMapKey(targetName, 'command');
  const candidates: (string | undefined)[] = [
    pluginFromSourceMap(defaultSourceMaps, root, executorKey),
    pluginFromSourceMap(defaultSourceMaps, root, commandKey),
    pluginFromSourceMap(specifiedSourceMaps, root, executorKey),
    pluginFromSourceMap(specifiedSourceMaps, root, commandKey),
  ];

  for (const candidate of candidates) {
    if (candidate && candidate !== 'nx/target-defaults') return candidate;
  }
  return undefined;
}

function pluginFromSourceMap(
  maps: ConfigurationSourceMaps | undefined,
  root: string,
  key: string
): string | undefined {
  const entry = maps?.[root]?.[key] as SourceInformation | undefined;
  return entry?.[1];
}

function buildProjectNodesByName(
  specifiedPluginRootMap: Record<string, ProjectConfiguration>,
  defaultPluginRootMap: Record<string, ProjectConfiguration>
): Record<string, ProjectGraphProjectNode> {
  const out: Record<string, ProjectGraphProjectNode> = {};
  const addFromMap = (map: Record<string, ProjectConfiguration>) => {
    for (const root of Object.keys(map)) {
      const cfg = map[root];
      const name = cfg?.name;
      if (!name) continue;
      if (out[name]) {
        // Merge tags (union) across layers so tag-based project filters
        // see all tags, regardless of which plugin contributed them.
        const existingTags = out[name].data.tags ?? [];
        const newTags = cfg.tags ?? [];
        out[name].data.tags = Array.from(
          new Set([...existingTags, ...newTags])
        );
      } else {
        out[name] = {
          name,
          type: 'lib',
          data: { root, tags: cfg.tags ?? [] },
        } as ProjectGraphProjectNode;
      }
    }
  };
  addFromMap(specifiedPluginRootMap);
  addFromMap(defaultPluginRootMap);
  return out;
}
