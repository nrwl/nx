import type { TargetConfiguration, TargetDefaults } from '@nx/devkit';
import {
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
  type JsonInput,
} from '@nx/devkit/internal';
import { PNPM_INSTALL_SETTINGS_INPUTS } from './pnpm-install-settings-inputs';
import {
  DEFAULT_INPUTS,
  compatibleDefaultsEntries,
  lastMatchingInputsSupplier,
  namedFilesets,
  selectDefaultsKey,
  type MatchedTargetRef,
} from './target-defaults-matching';

const ROOT_MANIFEST = '{workspaceRoot}/package.json';
const MANIFEST_SETTINGS_FIELDS = new Set(
  PNPM_INSTALL_SETTINGS_INPUTS.filter(
    (input): input is JsonInput => typeof input !== 'string' && 'json' in input
  ).flatMap((input) => input.fields ?? [])
);

type DeployInput = (typeof PNPM_INSTALL_SETTINGS_INPUTS)[number];

/**
 * Adds the missing `PNPM_INSTALL_SETTINGS_INPUTS` to the layer whose `inputs`
 * array the runtime actually uses for this target: the target's own `inputs`
 * when it declares them (its array replaces the defaults' rather than merging
 * with it), otherwise the matching `targetDefaults` entry supplying the array
 * it inherits, and otherwise the target itself with nx's own default spelled
 * out first, so nothing that was hashed stops being hashed. Sources the
 * effective inputs already hash, including via a whole-file root package.json
 * fileset or a `json` input covering the settings fields, are left alone; no
 * `'...'` is ever authored. Returns which layer was mutated, or null when
 * nothing was missing.
 */
export function addPnpmDeployOutputCacheInputs(
  ref: MatchedTargetRef,
  targetDefaults: TargetDefaults | undefined,
  executor: string
): 'target' | 'defaults' | null {
  const selectedKey = targetDefaults
    ? selectDefaultsKey(ref, targetDefaults, executor)
    : null;
  const entries = compatibleDefaultsEntries(ref, selectedKey, targetDefaults);
  const defaults = entries.length
    ? readTargetDefaultsForTarget(
        ref.targetName,
        { [selectedKey]: entries },
        ref.matcherExecutor,
        { projectName: ref.projectName, projectNode: ref.projectNode }
      )
    : null;
  const effective = mergeTargetConfigurations(ref.target, defaults ?? {});
  const missing = missingSettingsInputs(effective.inputs);
  if (missing.length === 0) {
    return null;
  }
  if (ref.target.inputs !== undefined) {
    appendInputs(ref.target, missing);
    return 'target';
  }
  const supplier = lastMatchingInputsSupplier(ref, selectedKey, entries);
  if (supplier) {
    appendInputs(supplier, missing);
    return 'defaults';
  }
  appendInputs(ref.target, missing);
  return 'target';
}

/**
 * The settings sources the effective inputs do not hash yet. The manifest
 * counts as covered by a whole-file fileset no negative pattern can cancel,
 * or by an existing `json` input that hashes all the settings fields (`json`
 * inputs are immune to fileset negations); the workspace yaml by its fileset
 * (a negative pattern cancelling that fileset has no input-level counter, so
 * it is left to the author who wrote it); the runtime probe by an identical
 * `runtime` entry.
 */
function missingSettingsInputs(
  inputs: TargetConfiguration['inputs']
): DeployInput[] {
  const filesets = namedFilesets(inputs);
  const missing: DeployInput[] = [];
  for (const input of PNPM_INSTALL_SETTINGS_INPUTS) {
    if (typeof input === 'string') {
      if (!filesets.has(input)) {
        missing.push(input);
      }
    } else if ('runtime' in input) {
      if (
        !(inputs ?? []).some(
          (existing) =>
            typeof existing === 'object' &&
            existing !== null &&
            'runtime' in existing &&
            existing.runtime === input.runtime
        )
      ) {
        missing.push(input);
      }
    } else if (
      !(filesets.has(ROOT_MANIFEST) && !negationMayCancel(inputs)) &&
      !(inputs ?? []).some(
        (existing) =>
          typeof existing === 'object' &&
          existing !== null &&
          'json' in existing &&
          existing.json === ROOT_MANIFEST &&
          [...MANIFEST_SETTINGS_FIELDS].every((field) =>
            jsonInputCoversField(existing, field)
          )
      )
    ) {
      missing.push(input);
    }
  }
  return missing;
}

/**
 * Whether a negative fileset entry could remove the source from the hash. Any
 * workspace-root-scoped negation counts, in the string or `{ fileset }` form:
 * nx's pattern syntax (globs, extglobs) is not re-evaluated here, and an
 * extra input for a source the negation does not actually touch is harmless.
 * Project-relative negations never match a workspace-root file.
 */
function negationMayCancel(inputs: TargetConfiguration['inputs']): boolean {
  return (inputs ?? []).some((existing) => {
    const pattern =
      typeof existing === 'string'
        ? existing
        : typeof existing === 'object' &&
            existing !== null &&
            'fileset' in existing
          ? existing.fileset
          : undefined;
    return (
      typeof pattern === 'string' &&
      pattern.startsWith('!') &&
      pattern.includes('{workspaceRoot}')
    );
  });
}

/**
 * Whether an existing `json` input hashes `field`: selected by the allowlist
 * (an entry covers its whole subtree) and not touched by the denylist, which
 * the hasher applies after selection. A denylist entry below the field only
 * removes part of its subtree, but that part is then unhashed, so it
 * disqualifies coverage too.
 */
function jsonInputCoversField(input: JsonInput, field: string): boolean {
  const selected =
    input.fields === undefined ||
    input.fields.some((path) => path === field || field.startsWith(`${path}.`));
  if (!selected) {
    return false;
  }
  return !(input.excludeFields ?? []).some(
    (path) =>
      path === field ||
      field.startsWith(`${path}.`) ||
      path.startsWith(`${field}.`)
  );
}

/**
 * Appends to an array that already exists, or writes nx's default as the base
 * when no layer declares one, so the configuration is never narrowed to the
 * settings sources alone.
 */
function appendInputs(
  config: TargetConfiguration,
  missing: DeployInput[]
): void {
  config.inputs = [...(config.inputs ?? DEFAULT_INPUTS), ...missing];
}
