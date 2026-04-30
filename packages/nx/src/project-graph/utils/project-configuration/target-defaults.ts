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
  targetSourceMapKey,
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
  const entries = normalizeTargetDefaults(targetDefaults);
  return findBestTargetDefault(
    targetName,
    executor,
    opts?.projectName,
    opts?.projectNode,
    opts?.sourcePlugin,
    entries,
    opts?.command
  );
}

type MatchKind = 'executor' | 'exactTarget' | 'globTarget';

interface Candidate {
  config: Partial<TargetConfiguration>;
  tier: number; // 1..5
  matchKind: MatchKind;
  index: number;
}

/**
 * Find the highest-specificity `targetDefaults` entry that applies to the
 * given (target, project, sourcePlugin) tuple. Ties are broken by later
 * array index. Returns the config slice with filter keys (`target`,
 * `projects`, `source`) stripped.
 *
 * Specificity tiers (highest wins):
 *   5: target + projects + source
 *   4: target + projects
 *   3: target + source
 *   2: target + executor (body-field) match
 *   1: target (or target + executor injection-only match) alone
 *
 * `executor` in a defaults body acts dually: when the target already
 * has an executor it is treated as a filter (matching bumps tier 1 → 2,
 * mismatch drops the entry); when the target has no executor and no
 * command, it still matches as an injector but does not bump the tier.
 *
 * Exact target / executor match beats glob target match within a tier.
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
    if (!entry || !entry.target) continue;

    const matchKind = matchTarget(entry.target, targetName, executor);
    if (!matchKind) continue;

    if (entry.source && entry.source !== sourcePlugin) continue;

    if (entry.projects !== undefined) {
      if (!projectName || !projectNode) continue;
      const patterns = Array.isArray(entry.projects)
        ? entry.projects
        : [entry.projects];
      const matched = findMatchingProjects(patterns, {
        [projectName]: projectNode,
      });
      if (!matched.includes(projectName)) continue;
    }

    const executorMatch = matchExecutorBody(
      entry.executor,
      executor,
      targetCommand
    );
    if (executorMatch === 'no-match') continue;

    let tier = 1;
    if (entry.projects !== undefined && entry.source !== undefined) tier = 5;
    else if (entry.projects !== undefined) tier = 4;
    else if (entry.source !== undefined) tier = 3;
    else if (executorMatch === 'filter') tier = 2;

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

/**
 * Dual-role check for a defaults entry's `executor` body field.
 *
 * - `entry.executor` absent: not applicable, treated as neutral.
 * - `entry.executor` matches target executor: filter match (specificity++).
 * - target has no executor and no command: injection match (no bump).
 * - target has a different executor or an unrelated command: skip.
 */
function matchExecutorBody(
  entryExecutor: string | undefined,
  targetExecutor: string | undefined,
  targetCommand: string | undefined
): 'neutral' | 'filter' | 'inject' | 'no-match' {
  if (!entryExecutor) return 'neutral';
  if (targetExecutor && targetExecutor === entryExecutor) return 'filter';
  if (!targetExecutor && !targetCommand) return 'inject';
  return 'no-match';
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
  // Exact target and executor matches are equivalent in specificity and
  // both beat a glob target match.
  return kind === 'globTarget' ? 0 : 1;
}

function matchTarget(
  entryTarget: string,
  targetName: string,
  executor: string | undefined
): MatchKind | null {
  if (executor && entryTarget === executor) return 'executor';
  if (entryTarget === targetName) return 'exactTarget';
  if (isGlobPattern(entryTarget) && minimatch(targetName, entryTarget)) {
    return 'globTarget';
  }
  return null;
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
 * preserving insertion order. Legacy record executor keys (e.g.
 * `nx:run-commands`) keep `target: key` — the matcher compares `target`
 * against both target names and executors, so executor semantics are
 * preserved.
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
    out.push({ ...value, target: key });
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
  // Prefer the executor/command source map entries (which identify the
  // plugin that originated the target) over the top-level `targets.<name>`
  // key (which tracks only the last writer).
  const candidates: (string | undefined)[] = [
    pluginFromSourceMap(
      specifiedSourceMaps,
      root,
      targetOptionSourceMapKey(targetName, 'executor')
    ),
    pluginFromSourceMap(
      specifiedSourceMaps,
      root,
      targetOptionSourceMapKey(targetName, 'command')
    ),
    pluginFromSourceMap(
      defaultSourceMaps,
      root,
      targetOptionSourceMapKey(targetName, 'executor')
    ),
    pluginFromSourceMap(
      defaultSourceMaps,
      root,
      targetOptionSourceMapKey(targetName, 'command')
    ),
    // Last-resort fallback — less reliable because it records the last
    // plugin to touch the target rather than the originator.
    pluginFromSourceMap(
      specifiedSourceMaps,
      root,
      targetSourceMapKey(targetName)
    ),
    pluginFromSourceMap(
      defaultSourceMaps,
      root,
      targetSourceMapKey(targetName)
    ),
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
      const name = cfg?.name ?? inferNameFromRoot(root);
      if (!name) continue;
      if (out[name]) {
        // Merge tags (union) across layers so tag-based project filters
        // see all tags, regardless of which plugin contributed them.
        const existingTags = out[name].data.tags ?? [];
        const newTags = cfg.tags ?? [];
        const mergedTags = Array.from(new Set([...existingTags, ...newTags]));
        out[name].data.tags = mergedTags;
      } else {
        out[name] = {
          name,
          type: 'lib',
          data: {
            root,
            tags: cfg.tags ?? [],
          },
        } as ProjectGraphProjectNode;
      }
    }
  };
  addFromMap(specifiedPluginRootMap);
  addFromMap(defaultPluginRootMap);
  return out;
}

function inferNameFromRoot(root: string): string | undefined {
  if (!root) return undefined;
  const parts = root.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1];
}
