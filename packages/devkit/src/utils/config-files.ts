import { logger } from 'nx/src/devkit-exports';

export interface ConfigFileNamePatterns {
  /** Config file names the plugin infers its default target from. */
  defaultName: RegExp;
  /** Config file names the plugin's createNodes glob matches. */
  mappableName: RegExp;
  /** The mappable names as a glob, for warnings. */
  mappableGlob: string;
}

export interface ConfigFileEntry {
  target: string;
  ci?: string;
}

// The daemon recomputes the graph repeatedly, so each warning prints once.
const printedWarnings = new Set<string>();

function warnOnce(message: string): void {
  if (!printedWarnings.has(message)) {
    printedWarnings.add(message);
    logger.warn(message);
  }
}

function isTargetName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function readEntry(value: unknown): ConfigFileEntry | string {
  if (typeof value === 'string') {
    return value
      ? { target: value }
      : 'its value must be a non-empty target name';
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'its value must be a target name or an object with a "target" name';
  }
  const { target, ci } = value as Record<string, unknown>;
  if (!isTargetName(target)) {
    return 'its "target" must be a non-empty target name';
  }
  if (ci === undefined) {
    return { target };
  }
  if (!isTargetName(ci)) {
    return 'its "ci" must be a non-empty target name';
  }
  if (ci === target) {
    return 'its "ci" target must differ from its "target"';
  }
  return { target, ci };
}

/**
 * Reads a plugin's `configFiles` option into a map from config file name to
 * the targets that file infers. A string value is shorthand for `{ target }`.
 * Entries the plugin can never apply are dropped with a warning.
 */
export function readConfigFiles(
  pluginName: string,
  configFiles: Record<string, unknown> | undefined,
  patterns: ConfigFileNamePatterns
): Map<string, ConfigFileEntry> {
  const entries = new Map<string, ConfigFileEntry>();
  for (const [fileName, value] of Object.entries(configFiles ?? {})) {
    const entry = /[\\/]/.test(fileName)
      ? 'keys are config file names in a project root, not paths'
      : !patterns.mappableName.test(fileName)
        ? `the plugin only reads config files named ${patterns.mappableGlob}`
        : readEntry(value);
    if (typeof entry === 'string') {
      warnOnce(
        `${pluginName}: ignoring the "${fileName}" entry of configFiles because ${entry}.`
      );
      continue;
    }
    entries.set(fileName, entry);
  }
  return entries;
}

/**
 * Resolves one target name of a default config file. The `configFiles` entry
 * wins over the top-level option, with a warning when the user set both to
 * different names.
 */
export function resolveConfigFileTarget(
  pluginName: string,
  fileName: string,
  field: keyof ConfigFileEntry,
  entryValue: string | undefined,
  option: { name: string; value: string | undefined }
): string | undefined {
  if (entryValue && option.value && entryValue !== option.value) {
    warnOnce(
      `${pluginName}: configFiles sets the "${fileName}" ${field === 'ci' ? 'ci target' : 'target'} to "${entryValue}", overriding ${option.name} "${option.value}".`
    );
  }
  return entryValue ?? option.value;
}

export interface ConfigFileTargets {
  configFile: string;
  isDefault: boolean;
  targetNames: string[];
}

/**
 * Throws when a mapped config file infers a target that another config file in
 * the same project root infers too. Default config files in one root merge
 * into the same project targets, so only mapped files are checked.
 */
export function assertUniqueConfigTargetNames(
  pluginName: string,
  projectRoot: string,
  configFile: ConfigFileTargets,
  siblingConfigFiles: ConfigFileTargets[]
): void {
  if (configFile.isDefault) {
    return;
  }
  for (const sibling of siblingConfigFiles) {
    if (sibling.configFile === configFile.configFile) {
      continue;
    }
    const shared = configFile.targetNames.find((name) =>
      sibling.targetNames.includes(name)
    );
    if (shared) {
      throw new Error(
        `${pluginName}: "${configFile.configFile}" and "${sibling.configFile}" in "${projectRoot}" both infer the "${shared}" target. Give each config file its own target name.`
      );
    }
  }
}
