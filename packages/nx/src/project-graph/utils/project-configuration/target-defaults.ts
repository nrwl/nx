import { minimatch } from 'minimatch';
import { join } from 'path';
import { toProjectName } from '../../../config/to-project-name';
import {
  NormalizedTargetDefaults,
  NxJsonConfiguration,
  TargetDefaultArrayEntry,
  TargetDefaults,
  TargetDefaultValue,
} from '../../../config/nx-json';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../../config/workspace-json-project-json';
import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import {
  findMatchingProjects,
  type MatcherProjectNode,
} from '../../../utils/find-matching-projects';
import { isGlobPattern } from '../../../utils/globs';
import type { CreateNodesResult } from '../../plugins/public-api';
import {
  SourceInformation,
  ConfigurationSourceMaps,
  targetSourceMapKey,
  TARGET_DEFAULTS_PLUGIN_NAME,
} from './source-maps';
import {
  deepClone,
  isCompatibleTarget,
  mergeTargetConfigurations,
  resolveCommandSyntacticSugar,
} from './target-merging';
import { uniqueKeysInObjects } from './utils';

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

  // The nested-array shape keeps target/executor/glob as map keys, so there
  // is nothing to disambiguate against the rootMaps — normalization simply
  // wraps each key's value into an array of entries.
  const targetDefaults = normalizeTargetDefaults(targetDefaultsConfig);
  if (Object.keys(targetDefaults).length === 0) {
    return [];
  }

  // `projectNodesByName` and `rootToName` are only consulted when an entry
  // has a `filter.projects` filter — that's the only matcher branch that
  // needs either the project name or its node. Source-plugin attribution is
  // root-keyed via `resolveSourcePlugin`, not name-keyed, so it doesn't
  // need either map. Skip both builds in the common no-filter path.
  const needsProjectNodes = Object.values(targetDefaults).some((entries) =>
    entries.some((e) => e.filter?.projects !== undefined)
  );
  const needsSourcePlugin = Object.values(targetDefaults).some((entries) =>
    entries.some((e) => e.filter?.plugin !== undefined)
  );
  const projectNodes = needsProjectNodes
    ? buildProjectNodesAndRootToName(
        specifiedPluginRootMap,
        defaultPluginRootMap
      )
    : undefined;

  // Bucketed by the resolving `targetDefaults` key and the matching entry's
  // array index, so each array element becomes its own synthetic result with an
  // element-specific `file`. A given (root, target) resolves from exactly one
  // key, and that key's entries merge downstream in ascending index order
  // (document order, later winning) — matching the in-key merge the reader does.
  const syntheticProjectsByKeyIndex: Record<
    string,
    Record<number, Record<string, ProjectConfiguration>>
  > = {};

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

      const sourcePlugin = needsSourcePlugin
        ? resolveSourcePlugin(
            root,
            targetName,
            specifiedSourceMaps,
            defaultSourceMaps
          )
        : undefined;

      const syntheticTargets = buildSyntheticTargetsForRoot(
        targetName,
        root,
        effective,
        targetDefaults,
        projectName,
        projectNode,
        sourcePlugin
      );

      for (const { key, index, target } of syntheticTargets) {
        const byIndex = (syntheticProjectsByKeyIndex[key] ??= {});
        const projectsForEntry = (byIndex[index] ??= {});
        projectsForEntry[root] ??= { root, targets: {} };
        projectsForEntry[root].targets[targetName] = target;
      }
    }
  }

  // One synthetic result per matching array element, each carrying a `file`
  // that points at that element so source maps attribute fields to
  // `nx.json#targetDefaults.<key>[<index>]` (or `.<key>` for the object form).
  // Emitted in ascending index order within a key so the downstream merge
  // layers a key's entries in document order, later winning.
  const results: CreateNodesResultEntry[] = [];
  for (const key of Object.keys(syntheticProjectsByKeyIndex)) {
    const isArrayForm = Array.isArray(targetDefaultsConfig[key]);
    const indices = Object.keys(syntheticProjectsByKeyIndex[key])
      .map(Number)
      .sort((a, b) => a - b);
    for (const index of indices) {
      results.push([
        TARGET_DEFAULTS_PLUGIN_NAME,
        targetDefaultSourceFile(key, isArrayForm ? index : undefined),
        { projects: syntheticProjectsByKeyIndex[key][index] },
      ]);
    }
  }
  return results;
}

// Encode the originating nx.json location into a synthetic result's `file`,
// reusing the `file` field as a location id rather than widening
// `SourceInformation` to carry a separate path. The object value form has no
// meaningful index (`nx.json#targetDefaults.build`); the array form points at
// the specific element (`nx.json#targetDefaults.build[3]`).
function targetDefaultSourceFile(key: string, index?: number): string {
  const location = index === undefined ? key : `${key}[${index}]`;
  return `nx.json#targetDefaults.${location}`;
}

// Returns the (executor, command) pair the real merge will land on at
// `(root, targetName)` — only the fields the matcher needs. Incompatible
// pairs wholesale-replace specified with default; compatible pairs let
// the default's executor win, otherwise the specified's.
//
// INVARIANT: this is a forward-prediction of what `mergeTargetConfigurations`
// (gated by `isCompatibleTarget`) produces for `executor`/`command`. Synthesis
// runs before the real merge, so it must reproduce that precedence here. If the
// merge's compatibility or executor-precedence rules change, update this in
// lockstep; the end-to-end agreement is exercised by the synthesis tests in
// `project-configuration-utils.spec.ts`.
type EffectiveTarget = {
  executor: string | undefined;
  command: string | undefined;
  // For a run-commands winner, the command identity (`options.command`/
  // `options.commands`) of the target the real merge lands on.
  // `isCompatibleTarget` keys run-commands compatibility off these, not the
  // top-level `command`, so the synthetic must carry them or it's
  // incompatible-replaced and dropped when the winner uses the
  // `options.commands` form (#36067).
  options?: { command?: unknown; commands?: unknown };
};

function effectiveTargetForLookup(
  specifiedTarget: TargetConfiguration | undefined,
  defaultTarget: TargetConfiguration | undefined,
  root: string
): EffectiveTarget | undefined {
  const resolvedSpecified = specifiedTarget
    ? resolveCommandSyntacticSugar(specifiedTarget, root)
    : undefined;
  const resolvedDefault = defaultTarget
    ? resolveCommandSyntacticSugar(defaultTarget, root)
    : undefined;

  if (resolvedSpecified && resolvedDefault) {
    if (!isCompatibleTarget(resolvedSpecified, resolvedDefault)) {
      return effectiveFromWinner(resolvedDefault);
    }
    return {
      executor: resolvedDefault.executor ?? resolvedSpecified.executor,
      command: resolvedDefault.command ?? resolvedSpecified.command,
      options:
        runCommandsCommandIdentity(resolvedDefault) ??
        runCommandsCommandIdentity(resolvedSpecified),
    };
  }
  if (resolvedSpecified) {
    return effectiveFromWinner(resolvedSpecified);
  }
  if (resolvedDefault) {
    return effectiveFromWinner(resolvedDefault);
  }
  return undefined;
}

function effectiveFromWinner(target: TargetConfiguration): EffectiveTarget {
  return {
    executor: target.executor,
    command: target.command,
    options: runCommandsCommandIdentity(target),
  };
}

// run-commands command identity lives in `options.command`/`options.commands`,
// not the top-level `command`. Returns just those fields (when present) for a
// run-commands target so the synthetic can be stamped to stay compatible with
// the winning target downstream (#36067). Undefined for any other executor.
function runCommandsCommandIdentity(
  target: TargetConfiguration
): { command?: unknown; commands?: unknown } | undefined {
  if (target.executor !== 'nx:run-commands') return undefined;
  const { command, commands } = target.options ?? {};
  if (command === undefined && commands === undefined) return undefined;
  return {
    ...(command !== undefined ? { command } : {}),
    ...(commands !== undefined ? { commands } : {}),
  };
}

/**
 * Returns one synthetic defaults target per matching `targetDefaults` entry for
 * `targetName` at `root` (empty when no defaults apply). Emitting per entry
 * rather than a single pre-merged target lets source maps attribute fields to
 * the specific array element they came from; the entries merge downstream in
 * document order. Each synthetic stamps the effective executor/command (and the
 * winner's run-commands options identity) so neither merge neighbor can
 * incompatible-replace it and drop its contributions.
 *
 * @param effective The shape the real merge will land on. Used both as the
 *   executor filter context and as the locked identity stamped onto the
 *   synthetic.
 */
function buildSyntheticTargetsForRoot(
  targetName: string,
  root: string,
  effective: EffectiveTarget,
  targetDefaults: NormalizedTargetDefaults,
  projectName: string | undefined,
  projectNode: MatcherProjectNode | undefined,
  sourcePlugin: string | undefined
): { key: string; index: number; target: TargetConfiguration }[] {
  const resolved = resolveTargetDefaultMatches(targetDefaults, targetName, {
    executor: effective.executor,
    projectName,
    projectNode,
    sourcePlugin,
    command: effective.command,
  });
  if (!resolved) return [];

  const synthetics: {
    key: string;
    index: number;
    target: TargetConfiguration;
  }[] = [];
  for (const { index, config } of resolved.matches) {
    const synthetic = resolveCommandSyntacticSugar(deepClone(config), root);

    // Compatibility guard, per entry: an entry incompatible with the effective
    // target shape (e.g. it sets a foreign `executor`) would wholesale-replace
    // the inferred/specified target during the real merge. Drop just that
    // entry rather than corrupt the target; compatible siblings still apply.
    if (
      !isCompatibleTarget(
        { executor: effective.executor, command: effective.command },
        synthetic
      )
    ) {
      continue;
    }

    // Pre-stamp executor/command from the effective shape so the
    // synthetic can't be incompatible-replaced during the real merge.
    if (effective.executor !== undefined) {
      synthetic.executor = effective.executor;
    }
    if (effective.command !== undefined) {
      synthetic.command = effective.command;
    }
    // run-commands compatibility keys off options.command/commands, not the
    // top-level command. Stamp the winner's so the synthetic stays compatible
    // when the winning target uses the options.commands form (#36067).
    if (effective.options !== undefined) {
      synthetic.options = { ...synthetic.options, ...effective.options };
    }

    synthetics.push({ key: resolved.key, index, target: synthetic });
  }
  return synthetics;
}

/**
 * Public reader that resolves the target defaults applying to a given
 * target. Accepts the nested map shape (a value is either a plain config
 * object or an array of filtered entries).
 *
 * When called without project/plugin context, filtered entries that require
 * a `projects` or `plugin` filter cannot match and are skipped — only
 * catch-all entries (and `executor`-filtered entries when an executor is
 * supplied) contribute.
 *
 * Normalization runs per call. It is just an array-wrap of each key's value
 * (cheap relative to graph construction), and `targetDefaults` is mutable and
 * read through this exported entry point — caching by object identity would
 * return stale matches when a caller edits a key between reads.
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
  return resolveTargetDefault(
    normalizeTargetDefaults(targetDefaults),
    targetName,
    {
      executor,
      projectName: opts?.projectName,
      projectNode: opts?.projectNode,
      sourcePlugin: opts?.sourcePlugin,
      command: opts?.command,
    }
  );
}

interface MatchContext {
  executor: string | undefined;
  projectName: string | undefined;
  projectNode: MatcherProjectNode | undefined;
  sourcePlugin: string | undefined;
  command: string | undefined;
}

/**
 * Resolve the merged target default for `targetName` against the normalized
 * map. Two levels of lookup:
 *
 * 1. **Outer key selection** — preserves the long-standing record-shape
 *    precedence: the executor key (when the target has that executor and the
 *    key exists) wins, then the exact target-name key, then glob keys
 *    (longest first). Keys are tried in that order and the first key with *any*
 *    matching entry wins — even one contributing an empty config, so an empty
 *    `{}` catch-all still wins and does not fall through. A key whose entries
 *    all fail their `filter` contributes nothing and falls through to the next,
 *    matching the record matcher's "key must apply" behavior.
 * 2. **Inner accumulate-and-merge** — within the selected key's array, every
 *    entry whose `filter` matches is merged in document order via
 *    `mergeTargetConfigurations`, so later matches override earlier ones
 *    field by field. An entry with no `filter` is a catch-all that always
 *    matches.
 */
function resolveTargetDefault(
  normalized: NormalizedTargetDefaults,
  targetName: string,
  ctx: MatchContext
): Partial<TargetConfiguration> | null {
  for (const key of orderedMatchingKeys(normalized, targetName, ctx.executor)) {
    const merged = mergeMatchingEntries(normalized[key], ctx);
    if (merged) return merged;
  }
  return null;
}

/**
 * For synthesis: the matching entries — with their original array indices — of
 * the first key that has any match (same key precedence as
 * {@link resolveTargetDefault}). Unlike that reader, the entries are NOT merged
 * here: each becomes its own synthetic node so source maps attribute fields to
 * the specific `targetDefaults` array element they came from, and the in-key
 * merge happens downstream in document (index) order.
 */
function resolveTargetDefaultMatches(
  normalized: NormalizedTargetDefaults,
  targetName: string,
  ctx: MatchContext
): {
  key: string;
  matches: { index: number; config: Partial<TargetConfiguration> }[];
} | null {
  for (const key of orderedMatchingKeys(normalized, targetName, ctx.executor)) {
    const entries = normalized[key];
    const matches: { index: number; config: Partial<TargetConfiguration> }[] =
      [];
    for (let index = 0; index < entries.length; index++) {
      if (!entryFilterMatches(entries[index].filter, ctx)) continue;
      matches.push({ index, config: stripFilter(entries[index]) });
    }
    if (matches.length > 0) {
      return { key, matches };
    }
  }
  return null;
}

/**
 * The candidate map keys for `targetName`, in record-shape precedence order
 * (highest first): executor key, exact name key, then glob keys longest
 * first (the longest glob is the most specific match). Yields lazily so the
 * glob scan is skipped entirely when an exact key already resolves a match.
 */
function* orderedMatchingKeys(
  normalized: NormalizedTargetDefaults,
  targetName: string,
  executor: string | undefined
): Iterable<string> {
  if (executor && normalized[executor]) {
    yield executor;
  }
  if (normalized[targetName] && targetName !== executor) {
    yield targetName;
  }
  const globKeys = Object.keys(normalized)
    .filter(
      (key) =>
        key !== targetName &&
        key !== executor &&
        isGlobPattern(key) &&
        minimatch(targetName, key)
    )
    .sort((a, b) => b.length - a.length);
  yield* globKeys;
}

/**
 * Merge every entry in `entries` whose `filter` matches `ctx`, in document
 * order with later matches winning. Returns null when no entry matched.
 */
function mergeMatchingEntries(
  entries: TargetDefaultArrayEntry[],
  ctx: MatchContext
): Partial<TargetConfiguration> | null {
  let acc: Partial<TargetConfiguration> | null = null;
  for (const entry of entries) {
    if (!entryFilterMatches(entry.filter, ctx)) continue;
    const config = stripFilter(entry);
    // A lone matching entry is returned without merging so deferred `'...'`
    // spread tokens survive for the downstream merge; only a second match
    // triggers a merge, later entry winning.
    acc = acc === null ? config : mergeTargetConfigurations(config, acc);
  }
  return acc;
}

/**
 * Test a single entry's `filter` against the resolution context. A missing
 * filter is a catch-all (always matches). Otherwise every present criterion
 * (`projects`, `plugin`, `executor`) must agree.
 */
function entryFilterMatches(
  filter: TargetDefaultArrayEntry['filter'],
  ctx: MatchContext
): boolean {
  if (!filter) return true;

  if (filter.projects) {
    const matched = findMatchingProjects([...filter.projects], {
      [ctx.projectName]: ctx.projectNode,
    });
    if (!matched.length) {
      return false;
    }
  }

  if (filter.plugin && filter.plugin !== ctx.sourcePlugin) {
    return false;
  }

  if (filter.executor && filter.executor !== ctx.executor) {
    return false;
  }

  return true;
}

/** Removes the `filter` namespace, leaving the merge payload. */
function stripFilter(
  entry: TargetDefaultArrayEntry
): Partial<TargetConfiguration> {
  const { filter, ...rest } = entry;
  return rest;
}

/**
 * Normalize the public `targetDefaults` map to the internal shape: every
 * key's value becomes an array of entries (a bare object → a single catch-all
 * entry).
 */
export function normalizeTargetDefaults(
  raw: TargetDefaults | undefined
): NormalizedTargetDefaults {
  if (!raw) return {};
  const normalized: NormalizedTargetDefaults = {};
  for (const key of Object.keys(raw)) {
    normalized[key] = normalizeTargetDefaultValue(raw[key]);
  }
  return normalized;
}

function normalizeTargetDefaultValue(
  value: TargetDefaultValue | undefined
): TargetDefaultArrayEntry[] {
  if (Array.isArray(value)) return value;
  // A bare config object is functionally a one-element array.
  return [value ?? {}];
}

function resolveSourcePlugin(
  root: string,
  targetName: string,
  specifiedSourceMaps: ConfigurationSourceMaps | undefined,
  defaultSourceMaps: ConfigurationSourceMaps | undefined
): string | undefined {
  // Default-plugin attribution overrides specified-plugin attribution in the
  // merge, so check it first. The executor/command keys carry the plugin that
  // *created* the target, which is what `filter.plugin` ("targets originated by
  // X") means. The top-level `targets.<name>` node key is deliberately NOT used
  // as a fallback: it tracks the last writer, so a later plugin augmenting the
  // target would mis-attribute it. The trade-off is that a target with neither
  // an executor nor a command (a rare, non-runnable shape) resolves to no
  // source plugin and won't match a `filter.plugin` default — accepted, since
  // every runnable target carries one of these keys.
  const executorKey = `${targetSourceMapKey(targetName)}.executor`;
  const commandKey = `${targetSourceMapKey(targetName)}.command`;
  const candidates: (string | undefined)[] = [
    pluginFromSourceMap(defaultSourceMaps, root, executorKey),
    pluginFromSourceMap(defaultSourceMaps, root, commandKey),
    pluginFromSourceMap(specifiedSourceMaps, root, executorKey),
    pluginFromSourceMap(specifiedSourceMaps, root, commandKey),
  ];

  for (const candidate of candidates) {
    if (candidate && candidate !== TARGET_DEFAULTS_PLUGIN_NAME)
      return candidate;
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

// Builds a name → MatcherProjectNode view for `findMatchingProjects` to
// consult, across both layered rootMaps. Tags are unioned across layers. A
// full `mergeProjectConfigurationIntoRootMap` would be overkill — the matcher
// only needs `data.root`/`data.tags`.
function buildProjectNodesAndRootToName(
  specifiedPluginRootMap: Record<string, ProjectConfiguration>,
  defaultPluginRootMap: Record<string, ProjectConfiguration>
): {
  projectNodesByName: Record<string, MatcherProjectNode>;
  rootToName: Map<string, string>;
} {
  const projectNodesByName: Record<string, MatcherProjectNode> = {};
  const rootToName = new Map<string, string>();
  const roots = new Set<string>([
    ...Object.keys(specifiedPluginRootMap),
    ...Object.keys(defaultPluginRootMap),
  ]);
  for (const root of roots) {
    const specifiedCfg = specifiedPluginRootMap[root];
    const defaultCfg = defaultPluginRootMap[root];
    // Synthesis runs before name inference, so an unnamed `project.json` has no
    // `name` yet. Derive it the same way normalization will — `toProjectName`
    // on the `project.json` path — so `projects:`/`tag:` filters resolve
    // instead of silently no-opping for the common unnamed-`project.json` case.
    // We don't gate on the file existing: if it truly doesn't, the project has
    // no valid name and the graph errors downstream anyway; here the derived
    // name is only used for filtering. Default-plugin name wins over specified,
    // matching the real merge's layering.
    const name =
      defaultCfg?.name ??
      specifiedCfg?.name ??
      toProjectName(join(root, 'project.json'));
    const tags = Array.from(
      new Set([...(specifiedCfg?.tags ?? []), ...(defaultCfg?.tags ?? [])])
    );
    rootToName.set(root, name);
    if (projectNodesByName[name]) {
      const existingTags = projectNodesByName[name].data.tags ?? [];
      projectNodesByName[name].data.tags = Array.from(
        new Set([...existingTags, ...tags])
      );
    } else {
      // `findMatchingProjects` only reads `data.root`/`data.tags`; the name
      // is carried by the map key and `rootToName`.
      projectNodesByName[name] = { data: { root, tags } };
    }
  }
  return { projectNodesByName, rootToName };
}
