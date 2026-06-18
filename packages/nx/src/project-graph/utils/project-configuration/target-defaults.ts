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
 *
 * Synthesis sees the two layers separately to avoid re-merging specified
 * results into a parallel rootMap — for each (root, target) where both
 * layers contribute, it computes the eventual executor/command on the
 * fly. That's all the matcher needs; the full target merge happens
 * downstream in the real merge.
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

  // Disambiguate `:`-shaped record keys against the actual targets and
  // executors present in the rootMaps. This is the same idea the v23
  // `convert-target-defaults-to-array` migration uses against the project
  // graph — we just consult the rootMaps directly here since we don't have
  // a graph yet during construction.
  const entries = normalizeTargetDefaultsAgainstRootMaps(
    targetDefaultsConfig,
    specifiedPluginRootMap,
    defaultPluginRootMap
  );
  if (entries.length === 0) {
    return [];
  }

  // `projectNodesByName` and `rootToName` are only consulted when an entry
  // has a `projects:` filter — that's the only matcher branch that needs
  // either the project name or its node. Source-plugin attribution is
  // root-keyed via `resolveSourcePlugin`, not name-keyed, so it doesn't
  // need either map. Skip both builds in the common no-filter path.
  const needsProjectNodes = entries.some((e) => e.projects !== undefined);
  const projectNodes = needsProjectNodes
    ? buildProjectNodesAndRootToName(
        specifiedPluginRootMap,
        defaultPluginRootMap
      )
    : undefined;

  const syntheticProjects: Record<string, ProjectConfiguration> = {};

  const allRoots = new Set<string>([
    ...Object.keys(specifiedPluginRootMap),
    ...Object.keys(defaultPluginRootMap),
  ]);

  for (const root of allRoots) {
    const specifiedTargets = specifiedPluginRootMap[root]?.targets ?? {};
    const defaultTargets = defaultPluginRootMap[root]?.targets ?? {};
    const projectName = projectNodes?.rootToName.get(root);
    const projectNode = projectName
      ? projectNodes!.projectNodesByName[projectName]
      : undefined;

    for (const targetName of uniqueKeysInObjects(
      specifiedTargets,
      defaultTargets
    )) {
      const effective = effectiveTargetForLookup(
        specifiedTargets[targetName],
        defaultTargets[targetName],
        root
      );
      if (!effective) continue;

      const sourcePlugin = resolveSourcePlugin(
        root,
        targetName,
        specifiedSourceMaps,
        defaultSourceMaps
      );

      const syntheticTarget = buildSyntheticTargetForRoot(
        targetName,
        root,
        effective,
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

// Returns the (executor, command) pair the real merge will land on at
// `(root, targetName)` — only the fields the matcher needs. Incompatible
// pairs wholesale-replace specified with default; compatible pairs let
// the default's executor win, otherwise the specified's.
function effectiveTargetForLookup(
  specifiedTarget: TargetConfiguration | undefined,
  defaultTarget: TargetConfiguration | undefined,
  root: string
): { executor: string | undefined; command: string | undefined } | undefined {
  const resolvedSpecified = specifiedTarget
    ? resolveCommandSyntacticSugar(specifiedTarget, root)
    : undefined;
  const resolvedDefault = defaultTarget
    ? resolveCommandSyntacticSugar(defaultTarget, root)
    : undefined;

  if (resolvedSpecified && resolvedDefault) {
    if (!isCompatibleTarget(resolvedSpecified, resolvedDefault)) {
      return {
        executor: resolvedDefault.executor,
        command: resolvedDefault.command,
      };
    }
    return {
      executor: resolvedDefault.executor ?? resolvedSpecified.executor,
      command: resolvedDefault.command ?? resolvedSpecified.command,
    };
  }
  if (resolvedSpecified) {
    return {
      executor: resolvedSpecified.executor,
      command: resolvedSpecified.command,
    };
  }
  if (resolvedDefault) {
    return {
      executor: resolvedDefault.executor,
      command: resolvedDefault.command,
    };
  }
  return undefined;
}

/**
 * Returns the synthetic defaults target to insert for `targetName` at
 * `root`, or undefined if no defaults apply. The synthetic stamps the
 * effective executor/command so neither merge neighbor can
 * incompatible-replace it and drop its contributions.
 *
 * @param effective The `(executor, command)` shape the real merge will
 *   land on. Used both to pick the highest-ranked compatible default
 *   (falling back to less-specific matches if the best one would be
 *   incompatible) and as the locked shape stamped onto the synthetic.
 */
function buildSyntheticTargetForRoot(
  targetName: string,
  root: string,
  effective: { executor: string | undefined; command: string | undefined },
  targetDefaults: NormalizedTargetDefaults,
  projectName: string | undefined,
  projectNode: ProjectGraphProjectNode | undefined,
  sourcePlugin: string | undefined
): TargetConfiguration | undefined {
  const rawTargetDefaults = findBestTargetDefault(
    targetName,
    effective.executor,
    projectName,
    projectNode,
    sourcePlugin,
    targetDefaults,
    effective.command,
    (candidate) =>
      isCompatibleTarget(
        { executor: effective.executor, command: effective.command },
        candidate
      )
  );
  if (!rawTargetDefaults) return undefined;

  const synthetic = resolveCommandSyntacticSugar(
    deepClone(rawTargetDefaults),
    root
  );

  // Pre-stamp executor/command from the effective shape so the
  // synthetic can't be incompatible-replaced during the real merge.
  if (effective.executor !== undefined) synthetic.executor = effective.executor;
  if (effective.command !== undefined) synthetic.command = effective.command;

  return synthetic;
}

/**
 * Public, backwards-compatible reader that looks up the most-specific
 * target default for a given target. Accepts either the new array shape
 * or the legacy record shape (devkit support).
 *
 * When called without project context, entries that require a `projects`
 * filter or a `plugin` filter are skipped.
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
  | 'globTarget'
  | 'filterOnly';

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
 * keys (`target`, `projects`, `plugin`) stripped.
 *
 * Tier = (1 if a target/executor locator matched, else 0) + 1 per
 * applied filter (`projects`, `plugin`). So locator-bearing entries:
 *   - tier 3: target/executor + projects + plugin
 *   - tier 2: target/executor + projects, or target/executor + plugin
 *   - tier 1: target/executor alone
 * And filter-only entries (no `target` and no `executor`):
 *   - tier 2: projects + plugin
 *   - tier 1: projects alone, or plugin alone
 *
 * `executor` matching contributes to matchKind only, not to tier — it's
 * not a filter, it's a refinement of the match. Within the same tier,
 * tie-break order (highest first):
 *   targetAndExecutor > executorOnly > exactTarget > globTarget > filterOnly
 *
 * `filterOnly` ranks below every locator-bearing kind, so a filter-only
 * entry can never tie-break ahead of one that names a target or executor
 * at the same tier.
 *
 * `executor` only acts as an "injector" (matches a target with neither
 * executor nor command) when the entry also sets `target`. Executor-only
 * entries require the workspace target to actually have an executor.
 *
 * When `predicate` is provided, ranked candidates are iterated and the
 * first one that satisfies the predicate is returned. This lets synthesis
 * fall back to a less-specific compatible default when the most-specific
 * match would be incompatible with the target it's being applied to.
 * Without a predicate, the highest-ranked candidate is returned directly.
 */
export function findBestTargetDefault(
  targetName: string,
  executor: string | undefined,
  projectName: string | undefined,
  projectNode:
    | (Pick<ProjectGraphProjectNode, 'name'> & {
        data: Pick<ProjectConfiguration, 'root' | 'tags'>;
      })
    | undefined,
  sourcePlugin: string | undefined,
  entries: NormalizedTargetDefaults,
  targetCommand?: string | undefined,
  predicate?: (config: Partial<TargetConfiguration>) => boolean
): Partial<TargetConfiguration> | null {
  if (!entries?.length) return null;

  // Single greedy best-so-far loop in both the predicate and no-predicate
  // paths. With a predicate, we filter candidates as they appear and only
  // promote one to `best` when it passes — equivalent to the previous
  // "collect-all + sort + first-passing" approach because `beats` is a
  // total order, but without the sort allocation.
  let best: Candidate | null = null;
  for (let i = 0; i < entries.length; i++) {
    const candidate = matchEntry(
      entries[i],
      i,
      targetName,
      executor,
      projectName,
      projectNode,
      sourcePlugin,
      targetCommand
    );
    if (!candidate) continue;
    if (predicate && !predicate(candidate.config)) continue;
    if (!best || beats(candidate, best)) {
      best = candidate;
    }
  }
  return best ? best.config : null;
}

/**
 * Classify the runtime intent of an entry's `projects:` value:
 *   - `none`: filter is absent — the entry is unscoped on the projects axis.
 *   - `empty`: filter is `[]` — matches no project, so the whole entry is
 *     dead. Treated as a never-match by the matcher rather than allowing
 *     the entry to silently apply nowhere (which is almost always a bug).
 *   - `wildcard`: filter is exactly `'*'` or `['*']` (or any combination of
 *     pure-wildcard patterns) — matches every project, equivalent to no
 *     filter at all. Doesn't count toward the broadcast guard or the
 *     specificity tier so the entry doesn't outrank a real, narrower one.
 *   - `filter`: a real pattern set the matcher needs to evaluate.
 */
function classifyProjectsFilter(
  projects: string | string[] | undefined
): 'none' | 'empty' | 'wildcard' | 'filter' {
  if (projects === undefined) return 'none';
  const arr = Array.isArray(projects) ? projects : [projects];
  if (arr.length === 0) return 'empty';
  if (arr.every((p) => p === '*')) return 'wildcard';
  return 'filter';
}

/**
 * Test a single `targetDefaults` entry against the (target, executor,
 * project, plugin, command) tuple of the target being resolved. Returns
 * a `Candidate` with its tier and match kind, or null when the entry
 * doesn't apply.
 *
 * The match facts (`targetName`, `executor`, `projectName`, `projectNode`,
 * `sourcePlugin`, `targetCommand`) are passed in instead of being read
 * from the graph node here because callers — `findBestTargetDefault` and
 * `buildSyntheticTargetForRoot` — work in different graph contexts. The
 * synthetic builder, in particular, evaluates against the *effective*
 * executor/command (what the merge will land on), which doesn't always
 * equal the node's current executor; threading the values explicitly
 * keeps that asymmetry visible at the call sites.
 */
function matchEntry(
  entry: TargetDefaultEntry | undefined,
  index: number,
  targetName: string,
  executor: string | undefined,
  projectName: string | undefined,
  projectNode:
    | (Pick<ProjectGraphProjectNode, 'name'> & {
        data: Pick<ProjectConfiguration, 'root' | 'tags'>;
      })
    | undefined,
  sourcePlugin: string | undefined,
  targetCommand: string | undefined
): Candidate | null {
  if (!entry) return null;
  // `normalizeTargetDefaults` already drops entries with neither locator
  // nor real filter. Empty-array `projects:` is an explicit never-match
  // shape — kept by the normalizer because it's named, rejected here.
  const projectsKind = classifyProjectsFilter(entry.projects);
  if (projectsKind === 'empty') return null;

  let targetKind: 'exact' | 'glob' | null = null;
  if (entry.target !== undefined) {
    if (entry.target === targetName) targetKind = 'exact';
    else if (isGlobPattern(entry.target) && minimatch(targetName, entry.target))
      targetKind = 'glob';
    else return null;
  }

  let executorMatched = false;
  if (entry.executor !== undefined) {
    if (executor && executor === entry.executor) {
      executorMatched = true;
    } else if (targetKind !== null && !executor && !targetCommand) {
      // Bare target with no executor — safe to inject the entry's
      // executor because the target locator has already narrowed the match.
      executorMatched = true;
    } else {
      return null;
    }
  }

  // Locator-bearing entries get a base tier of 1 (the locator match);
  // filter-only entries start at 0 so a single filter doesn't tie a
  // single locator. Filters then add 1 each — with the matchKind
  // tie-break below, filter-only always loses to locator-bearing at
  // the same final tier.
  const hasLocator = targetKind !== null || executorMatched;
  let tier = hasLocator ? 1 : 0;

  if (projectsKind === 'filter') {
    if (!projectName || !projectNode) return null;
    // Copy — `findMatchingProjects` prepends `*` for a leading negation
    // and would otherwise mutate the shared nxJson entry.
    const patterns = Array.isArray(entry.projects)
      ? [...entry.projects!]
      : [entry.projects!];
    const matched = findMatchingProjects(patterns, {
      [projectName]: projectNode as ProjectGraphProjectNode,
    });
    if (!matched.includes(projectName)) return null;
    tier++;
  }

  if (entry.plugin !== undefined) {
    if (entry.plugin !== sourcePlugin) return null;
    tier++;
  }

  // Safety net for callers (e.g. direct unit-test calls) that bypass
  // `normalizeTargetDefaults`: an entry with no locator and no real
  // filter has tier 0 after processing — it would broadcast to every
  // (root, target) in the workspace.
  if (!hasLocator && tier === 0) return null;

  const matchKind: MatchKind =
    targetKind !== null && executorMatched
      ? 'targetAndExecutor'
      : executorMatched
        ? 'executorOnly'
        : targetKind === 'exact'
          ? 'exactTarget'
          : targetKind === 'glob'
            ? 'globTarget'
            : 'filterOnly';

  return {
    config: stripFilterKeys(entry),
    tier,
    matchKind,
    index,
  };
}

/**
 * Specificity ordering for two candidate matches. Higher specificity
 * wins because the more specific entry is the one the user most likely
 * wrote to override a broader rule.
 *
 * 1. Tier — entries with `projects` or `plugin` filters are scoped
 *    narrower than unfiltered entries, so they outrank.
 * 2. Match kind — within the same tier, more locator slots is more
 *    specific: `target+executor` > `executor-only` > `exactTarget` >
 *    `globTarget` > `filterOnly`. Note `executor-only` outranks
 *    `exactTarget`: a workspace-wide rule keyed on a specific executor
 *    is treated as more intentional than a target-name rule that might
 *    accidentally catch unrelated executors. `filterOnly` (no `target`
 *    and no `executor`, just `projects` and/or `plugin`) sits at the
 *    bottom — it's the explicit "least specific" tier that lets a bare
 *    `plugin: '@nx/jest/plugin'` apply to every jest-attributed target
 *    while still losing to any entry that names the target or executor.
 * 3. Tie-break — later array index wins, so users can append an entry
 *    to override earlier ones without rewriting them.
 */
function beats(a: Candidate, b: Candidate): boolean {
  if (a.tier !== b.tier) return a.tier > b.tier;
  const aRank = matchKindRank(a.matchKind);
  const bRank = matchKindRank(b.matchKind);
  if (aRank !== bRank) return aRank > bRank;
  return a.index > b.index;
}

function matchKindRank(kind: MatchKind): number {
  switch (kind) {
    case 'targetAndExecutor':
      return 4;
    case 'executorOnly':
      return 3;
    case 'exactTarget':
      return 2;
    case 'globTarget':
      return 1;
    case 'filterOnly':
      return 0;
  }
}

/** Removes keys used only for locating the defaults, leaving the merge payload. */
function stripFilterKeys(
  entry: TargetDefaultEntry
): Partial<TargetConfiguration> {
  const { target, projects, plugin, ...rest } = entry;
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
 * Disambiguation here is purely syntactic — `:` in a record key is
 * genuinely ambiguous (target names can contain `:`). Callers that have
 * access to the workspace's targets (the graph-construction path, the
 * v23 migration) should prefer
 * {@link normalizeTargetDefaultsAgainstRootMaps} or the migration's
 * graph-based classifier so that ambiguous keys get classified by what
 * the workspace actually contains. The warning below points end-users
 * at `nx repair`, which runs the migration that durably resolves the
 * ambiguity in nx.json on disk.
 */
export function normalizeTargetDefaults(
  raw: TargetDefaults | undefined
): NormalizedTargetDefaults {
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw : recordToEntries(raw);
  return entries.filter(isWellFormedEntry);
}

function recordToEntries(raw: TargetDefaultsRecord): TargetDefaultEntry[] {
  warnAboutLegacyRecordShapeOnce();
  const out: TargetDefaultEntry[] = [];
  for (const key of Object.keys(raw)) {
    const value = raw[key] ?? {};
    out.push(...syntacticallyClassifyLegacyKey(key, value));
  }
  return out;
}

/**
 * An entry is well-formed when it has at least one locator (`target` /
 * `executor`) or a real filter (`projects` resolving to something other
 * than empty/wildcard, or `plugin`). Pre-filtering here lets the matcher
 * trust its inputs and skip the per-entry broadcast guard.
 */
function isWellFormedEntry(entry: TargetDefaultEntry): boolean {
  if (entry.target !== undefined) return true;
  if (entry.executor !== undefined) return true;
  if (entry.plugin !== undefined) return true;
  return classifyProjectsFilter(entry.projects) === 'filter';
}

/**
 * Same shape contract as {@link normalizeTargetDefaults}, but classifies
 * `:`-shaped record keys against the targets and executors actually
 * present in the supplied rootMaps. When a key matches a target name in
 * the workspace, it becomes a `target:` entry; when it matches an
 * executor, an `executor:` entry; when it matches both, both entries are
 * emitted (matching the v23 migration's "duplicate rather than guess"
 * behavior so neither side of the match silently drops). Falls back to
 * the syntactic heuristic when there's no evidence either way.
 */
export function normalizeTargetDefaultsAgainstRootMaps(
  raw: TargetDefaults | undefined,
  ...rootMaps: Record<string, ProjectConfiguration>[]
): NormalizedTargetDefaults {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  warnAboutLegacyRecordShapeOnce();

  const targetNames = new Set<string>();
  const executors = new Set<string>();
  for (const map of rootMaps) {
    for (const cfg of Object.values(map)) {
      const targets = cfg?.targets;
      if (!targets) continue;
      for (const [name, target] of Object.entries(targets)) {
        targetNames.add(name);
        if (target?.executor) executors.add(target.executor);
      }
    }
  }

  const out: TargetDefaultEntry[] = [];
  for (const key of Object.keys(raw)) {
    const value = (raw as TargetDefaultsRecord)[key] ?? {};
    if (isGlobPattern(key)) {
      out.push({ ...value, target: key });
      continue;
    }
    const matchesTarget = targetNames.has(key);
    const matchesExecutor = executors.has(key);
    if (matchesTarget && matchesExecutor) {
      out.push({ ...value, target: key }, { ...value, executor: key });
    } else if (matchesExecutor) {
      out.push({ ...value, executor: key });
    } else if (matchesTarget) {
      out.push({ ...value, target: key });
    } else {
      out.push(...syntacticallyClassifyLegacyKey(key, value));
    }
  }
  return out;
}

function syntacticallyClassifyLegacyKey(
  key: string,
  value: Partial<TargetConfiguration>
): TargetDefaultEntry[] {
  return [
    key.includes(':') && !isGlobPattern(key)
      ? { ...value, executor: key }
      : { ...value, target: key },
  ];
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
    'The object/record form of `targetDefaults` is deprecated. Nx still reads it for now, but the array form is required to use the new `projects` and `plugin` filters.',
    'Run `nx repair` to automatically convert `targetDefaults` to the array shape.',
  ];
  process.stderr.write(
    `${EOL}${title}${EOL}${EOL}${bodyLines
      .map((l) => `  ${l}`)
      .join(EOL)}${EOL}${EOL}`
  );
}

function resolveSourcePlugin(
  root: string,
  targetName: string,
  specifiedSourceMaps: ConfigurationSourceMaps | undefined,
  defaultSourceMaps: ConfigurationSourceMaps | undefined
): string | undefined {
  // Default-plugin attribution overrides specified-plugin attribution in
  // the merge, so we check it first. Only the executor/command keys are
  // reliable — the top-level `targets.<name>` key tracks the last writer.
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

// Walks both layered rootMaps and produces a name → ProjectGraphProjectNode
// view for `findMatchingProjects` to consult. Default-plugin-only
// projects are included — they're the bulk of typical workspaces and
// `projects:` filters need to apply to them too. Tags are unioned across
// layers so tag-based filters see all contributions.
//
// We don't reuse `mergeProjectConfigurationIntoRootMap` here: it does a
// full project-config merge (targets, named inputs, source maps, ...)
// keyed by root, while this function only needs name + tags keyed by
// name. The full merge would be substantial wasted work on every graph
// build.
function buildProjectNodesAndRootToName(
  specifiedPluginRootMap: Record<string, ProjectConfiguration>,
  defaultPluginRootMap: Record<string, ProjectConfiguration>
): {
  projectNodesByName: Record<string, ProjectGraphProjectNode>;
  rootToName: Map<string, string>;
} {
  const projectNodesByName: Record<string, ProjectGraphProjectNode> = {};
  const rootToName = new Map<string, string>();
  const addFromMap = (map: Record<string, ProjectConfiguration>) => {
    for (const root of Object.keys(map)) {
      const cfg = map[root];
      const name = cfg?.name;
      if (!name) continue;
      if (projectNodesByName[name]) {
        const existingTags = projectNodesByName[name].data.tags ?? [];
        const newTags = cfg.tags ?? [];
        projectNodesByName[name].data.tags = Array.from(
          new Set([...existingTags, ...newTags])
        );
      } else {
        projectNodesByName[name] = {
          name,
          type: cfg.projectType === 'application' ? 'app' : 'lib',
          data: { root, tags: cfg.tags ?? [] },
        } as ProjectGraphProjectNode;
        rootToName.set(root, name);
      }
    }
  };
  addFromMap(specifiedPluginRootMap);
  addFromMap(defaultPluginRootMap);
  return { projectNodesByName, rootToName };
}
