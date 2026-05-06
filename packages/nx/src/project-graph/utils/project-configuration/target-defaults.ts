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

  const entries = normalizeTargetDefaults(targetDefaultsConfig);
  if (entries.length === 0) {
    return [];
  }

  // The by-name node map is only consulted when an entry has a
  // `projects:` filter. Skip building it for the common case where no
  // entry uses that filter — workspaces with simple targetDefaults
  // shouldn't pay the per-project iteration cost on every graph build.
  const needsProjectNodes = entries.some((e) => e.projects !== undefined);
  const { projectNodesByName, rootToName } = needsProjectNodes
    ? buildProjectNodesAndRootToName(
        specifiedPluginRootMap,
        defaultPluginRootMap
      )
    : {
        projectNodesByName: undefined,
        rootToName: buildRootToName(
          specifiedPluginRootMap,
          defaultPluginRootMap
        ),
      };

  const syntheticProjects: Record<string, ProjectConfiguration> = {};

  const allRoots = new Set<string>([
    ...Object.keys(specifiedPluginRootMap),
    ...Object.keys(defaultPluginRootMap),
  ]);

  for (const root of allRoots) {
    const specifiedTargets = specifiedPluginRootMap[root]?.targets ?? {};
    const defaultTargets = defaultPluginRootMap[root]?.targets ?? {};
    const projectName = rootToName.get(root);
    const projectNode =
      projectName && projectNodesByName
        ? projectNodesByName[projectName]
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

// Returns the executor/command pair the real merge will end up with at
// `(root, targetName)`. We don't reproduce the full per-target merge
// here — only the fields the matcher cares about. For incompatible
// pairs (e.g. specified `nx:run-commands` vs default `@nx/jest:jest`)
// the default replaces the specified target wholesale, so we mirror
// that behavior by returning the default. For compatible pairs, the
// default's executor wins where set, otherwise the specified's.
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

  if (!resolvedSpecified && !resolvedDefault) return undefined;
  if (!resolvedSpecified) {
    return {
      executor: resolvedDefault!.executor,
      command: resolvedDefault!.command,
    };
  }
  if (!resolvedDefault) {
    return {
      executor: resolvedSpecified.executor,
      command: resolvedSpecified.command,
    };
  }
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
  entries: NormalizedTargetDefaults,
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
    entries,
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

  // Stamp executor/command from the effective shape. For entries that
  // already specify these, this is a no-op (the matcher only returned
  // compatible candidates). For entries that don't, this pre-aligns the
  // synthetic with both layers so neither can incompatible-replace it
  // during the real merge.
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
  projectNode: ProjectGraphProjectNode | undefined,
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
 * Test a single `targetDefaults` entry against the (target, executor,
 * project, source, command) tuple of the target being resolved. Returns
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
  projectNode: ProjectGraphProjectNode | undefined,
  sourcePlugin: string | undefined,
  targetCommand: string | undefined
): Candidate | null {
  if (!entry) return null;
  if (entry.target === undefined && entry.executor === undefined) return null;

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
      // Injection: the entry's `target` locator already narrowed the match
      // to a specific name, so it's safe to inject the entry's executor
      // into a bare target. An executor-only entry (no `target` locator)
      // never reaches this branch — without targeting, it would broadcast
      // the executor to every executor-less target in the workspace.
      executorMatched = true;
    } else {
      return null;
    }
  }

  let tier = 1;

  if (entry.projects !== undefined) {
    if (!projectName || !projectNode) return null;
    const patterns = Array.isArray(entry.projects)
      ? entry.projects
      : [entry.projects];
    const matched = findMatchingProjects(patterns, {
      [projectName]: projectNode,
    });
    if (!matched.includes(projectName)) return null;
    tier++;
  }

  if (entry.source !== undefined) {
    if (entry.source !== sourcePlugin) return null;
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
 * 1. Tier — entries with `projects` or `source` filters are scoped
 *    narrower than unfiltered entries, so they outrank.
 * 2. Match kind — within the same tier, more locator slots is more
 *    specific: `target+executor` > `executor-only` > `exactTarget` >
 *    `globTarget`. Note `executor-only` outranks `exactTarget`: a
 *    workspace-wide rule keyed on a specific executor is treated as
 *    more intentional than a target-name rule that might accidentally
 *    catch unrelated executors.
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
      return 3;
    case 'executorOnly':
      return 2;
    case 'exactTarget':
      return 1;
    case 'globTarget':
      return 0;
  }
}

/** Removes keys used only for locating the defaults, leaving the merge payload. */
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
 * The disambiguation here is purely syntactic. This function runs
 * during graph construction, before the cached graph exists, so it
 * cannot consult per-project targets to confirm whether `key` is a
 * target name or an executor — `:` in a record key is genuinely
 * ambiguous (target names can contain `:`). The
 * `convert-target-defaults-to-array` migration runs *after*
 * construction and uses the project graph for proper disambiguation;
 * that's why the warning below recommends `nx repair`. Sharing more of
 * the disambiguation logic with the migration is left as a follow-up —
 * the migration's classifier needs the graph and this code path can't
 * have one.
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

/**
 * Lighter-weight version of {@link buildProjectNodesAndRootToName} for
 * the common path where no `targetDefaults` entry uses a `projects:`
 * filter. We still need root → name lookup for source-plugin attribution
 * and project-name resolution, but we can skip building the by-name
 * node view entirely.
 */
function buildRootToName(
  specifiedPluginRootMap: Record<string, ProjectConfiguration>,
  defaultPluginRootMap: Record<string, ProjectConfiguration>
): Map<string, string> {
  const rootToName = new Map<string, string>();
  const addFromMap = (map: Record<string, ProjectConfiguration>) => {
    for (const root of Object.keys(map)) {
      const name = map[root]?.name;
      if (name && !rootToName.has(root)) rootToName.set(root, name);
    }
  };
  addFromMap(specifiedPluginRootMap);
  addFromMap(defaultPluginRootMap);
  return rootToName;
}
