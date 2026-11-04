import { minimatch } from 'minimatch';
import type {
  NxJsonConfiguration,
  ProjectGraphProjectNode,
  TargetConfiguration,
  TargetDefaultArrayEntry,
} from 'nx/src/devkit-exports';
import {
  isGlobPattern,
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
} from 'nx/src/devkit-internals';
import { isExactTargetNameKey } from '../target-defaults-utils';
import { stableStringify } from './plugin-migration-utils';

/**
 * What a migrated `(project, target)` needs, captured at Phase 2 against the
 * pre-migration `nx.json`, to keep its `targetDefaults` resolution stable once
 * the final `nx.json` is written.
 */
export interface TargetDefaultsShiftInputs {
  /** The defaults the executor target resolved before conversion. */
  defaultsBefore: Partial<TargetConfiguration>;
  /**
   * Fields the project config set, including the executor-keyed defaults
   * Phase 2 folded into it. Defaults did not decide these.
   */
  projectOwned: { fields: string[]; options: string[] };
  /** The target exactly as the plugin inferred it, before any targetDefaults. */
  rawInferred: TargetConfiguration;
  inferredExecutor: string | undefined;
  /** Every other target the plugin infers for the project -> its executor. */
  siblingExecutors: Record<string, string | undefined>;
}

export interface ShiftPair {
  projectName: string;
  targetName: string;
  projectNode: ProjectGraphProjectNode | undefined;
  inputs: TargetDefaultsShiftInputs;
  /** The project config target as it ends up written. */
  written: TargetConfiguration;
}

export interface TargetDefaultsShiftResult {
  /** Corrections a filtered entry cannot single out; merge into the project config. */
  projectCorrections: Array<{
    projectName: string;
    targetName: string;
    correction: Partial<TargetConfiguration>;
  }>;
  /** `"<project> > <target>"` -> fields a default now sets that no correction can unset. */
  unexpressible: Map<string, string[]>;
}

// Fields whose absence a literal reproduces; anything else unset by both the
// pre-migration defaults and the inferred target cannot be undone by a merge.
const NEUTRAL_VALUES: Partial<TargetConfiguration> = {
  dependsOn: [],
  cache: false,
  outputs: [],
  parallelism: true,
  inputs: ['default', '^default'],
};

const SKIPPED_FIELDS = new Set([
  'executor',
  'command',
  'options',
  'configurations',
  'metadata',
  '...',
]);

/**
 * Correct each migrated target so it resolves, against the final `nx.json`,
 * the defaults it resolved before conversion. Appends filtered entries to
 * `nxJson.targetDefaults` in place and returns the corrections only the
 * project config can carry. Must run after every other `nx.json` write.
 */
export function correctTargetDefaultsShift(
  nxJson: NxJsonConfiguration,
  pluginPath: string,
  pairs: ShiftPair[]
): TargetDefaultsShiftResult {
  const result: TargetDefaultsShiftResult = {
    projectCorrections: [],
    unexpressible: new Map(),
  };
  const groups = new Map<
    string,
    {
      key: string;
      correction: Partial<TargetConfiguration>;
      projects: string[];
    }
  >();

  for (const pair of pairs) {
    const { projectName, targetName, inputs, written } = pair;
    const identityInProjectConfig =
      written.executor !== undefined || written.command !== undefined;
    const executor = identityInProjectConfig
      ? (written.executor ?? 'nx:run-commands')
      : inputs.inferredExecutor;
    const opts = {
      projectName,
      projectNode: pair.projectNode,
      sourcePlugin: identityInProjectConfig ? undefined : pluginPath,
    };
    const after = readTargetDefaultsForTarget(
      targetName,
      nxJson.targetDefaults,
      executor,
      opts
    );

    const { correction, unexpressible } = diffAgainstBefore(after, pair);
    if (unexpressible.length > 0) {
      result.unexpressible.set(`${projectName} > ${targetName}`, unexpressible);
    }
    if (Object.keys(correction).length === 0) {
      continue;
    }

    const key =
      after === null
        ? targetName
        : winningKey(nxJson, targetName, executor, opts);
    const entryReachesSibling = Object.entries(inputs.siblingExecutors).some(
      ([siblingName, siblingExecutor]) =>
        siblingExecutor === key ||
        (isGlobPattern(key) && minimatch(siblingName, key))
    );
    if (
      identityInProjectConfig ||
      entryReachesSibling ||
      (after === null && !isExactTargetNameKey(targetName))
    ) {
      result.projectCorrections.push({ projectName, targetName, correction });
      continue;
    }

    const groupKey = `${key}\0${stableStringify(correction)}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { key, correction, projects: [] });
    }
    groups.get(groupKey).projects.push(projectName);
  }

  for (const { key, correction, projects } of groups.values()) {
    appendTargetDefaultEntry(nxJson, key, {
      filter: { plugin: pluginPath, projects: [...new Set(projects)].sort() },
      ...correction,
    });
  }

  return result;
}

/** `target` with `correction` layered on top, merging options key by key. */
export function withCorrection(
  target: TargetConfiguration,
  correction: Partial<TargetConfiguration>
): TargetConfiguration {
  const corrected = {
    ...structuredClone(target),
    ...structuredClone(correction),
  };
  if (target.options && correction.options) {
    corrected.options = {
      ...structuredClone(target.options),
      ...structuredClone(correction.options),
    };
  }
  return corrected;
}

/** Append `entry` after whatever value `key` already holds. */
export function appendTargetDefaultEntry(
  nxJson: NxJsonConfiguration,
  key: string,
  entry: TargetDefaultArrayEntry
): void {
  nxJson.targetDefaults ??= {};
  const existing = nxJson.targetDefaults[key];
  nxJson.targetDefaults[key] =
    existing === undefined
      ? [entry]
      : Array.isArray(existing)
        ? [...existing, entry]
        : [existing, entry];
}

function diffAgainstBefore(
  after: Partial<TargetConfiguration> | null,
  pair: ShiftPair
): { correction: Partial<TargetConfiguration>; unexpressible: string[] } {
  const { inputs, written } = pair;
  const got = overInferred(after ?? {}, inputs.rawInferred);
  const want = overInferred(inputs.defaultsBefore, inputs.rawInferred);
  const ownedFields = new Set([
    ...inputs.projectOwned.fields,
    ...Object.keys(written),
  ]);
  const ownedOptions = new Set([
    ...inputs.projectOwned.options,
    ...Object.keys(written.options ?? {}),
  ]);

  const correction: Partial<TargetConfiguration> = {};
  const unexpressible: string[] = [];
  const fields = new Set([...Object.keys(got), ...Object.keys(want)]);
  for (const field of [...fields].sort()) {
    if (SKIPPED_FIELDS.has(field) || ownedFields.has(field)) {
      continue;
    }
    if (stableStringify(got[field]) === stableStringify(want[field])) {
      continue;
    }
    const value =
      want[field] !== undefined ? want[field] : NEUTRAL_VALUES[field];
    if (value === undefined) {
      unexpressible.push(field);
    } else {
      correction[field] = structuredClone(value);
    }
  }

  const optionCorrection: Record<string, unknown> = {};
  const optionKeys = new Set([
    ...Object.keys(got.options ?? {}),
    ...Object.keys(want.options ?? {}),
  ]);
  for (const option of [...optionKeys].sort()) {
    if (ownedOptions.has(option)) {
      continue;
    }
    const gotValue = got.options?.[option];
    const wantValue = want.options?.[option];
    if (stableStringify(gotValue) === stableStringify(wantValue)) {
      continue;
    }
    if (wantValue === undefined) {
      unexpressible.push(`options.${option}`);
    } else {
      optionCorrection[option] = structuredClone(wantValue);
    }
  }
  if (Object.keys(optionCorrection).length > 0) {
    correction.options = optionCorrection;
  }

  if (
    !ownedFields.has('configurations') &&
    stableStringify(got.configurations ?? {}) !==
      stableStringify(want.configurations ?? {})
  ) {
    unexpressible.push('configurations');
  }

  return { correction, unexpressible };
}

/** `defaults` layered over the inferred target, the way graph construction merges them. */
function overInferred(
  defaults: Partial<TargetConfiguration>,
  rawInferred: TargetConfiguration
): TargetConfiguration {
  const { executor: _executor, command: _command, ...rest } = defaults;
  return mergeTargetConfigurations(
    structuredClone(rest),
    structuredClone(rawInferred)
  );
}

/**
 * The `targetDefaults` key whose entries resolve for the target, in the
 * reader's precedence order: executor, exact name, then globs longest first.
 */
function winningKey(
  nxJson: NxJsonConfiguration,
  targetName: string,
  executor: string | undefined,
  opts: Parameters<typeof readTargetDefaultsForTarget>[3]
): string {
  const targetDefaults = nxJson.targetDefaults ?? {};
  const globKeys = Object.keys(targetDefaults)
    .filter(
      (key) =>
        key !== targetName &&
        key !== executor &&
        isGlobPattern(key) &&
        minimatch(targetName, key)
    )
    .sort((a, b) => b.length - a.length);
  const candidates = [
    ...(executor !== undefined && executor in targetDefaults ? [executor] : []),
    ...(targetName in targetDefaults && targetName !== executor
      ? [targetName]
      : []),
    ...globKeys,
  ];
  return candidates.find(
    (key) =>
      readTargetDefaultsForTarget(
        targetName,
        { [key]: targetDefaults[key] },
        executor,
        opts
      ) !== null
  );
}
