import { logger } from 'nx/src/devkit-exports';

export interface ConfigFileNamePatterns {
  /** Config file names the plugin infers its default target from. */
  defaultName: RegExp;
  /** Config file names the plugin's createNodes glob matches. */
  mappableName: RegExp;
  /** The mappable names as a glob, for warnings. */
  mappableGlob: string;
}

/**
 * Reads a plugin's `configToTargetName` option into a map from config file name
 * to target name. Entries the plugin can never infer are dropped with a warning.
 */
export function readConfigToTargetName(
  pluginName: string,
  configToTargetName: Record<string, unknown> | undefined,
  patterns: ConfigFileNamePatterns
): Map<string, string> {
  const targetNames = new Map<string, string>();
  for (const [fileName, targetName] of Object.entries(
    configToTargetName ?? {}
  )) {
    const problem =
      typeof targetName !== 'string' || !targetName
        ? 'its value must be a non-empty target name'
        : /[\\/]/.test(fileName)
          ? 'keys are config file names in a project root, not paths'
          : patterns.defaultName.test(fileName)
            ? 'the plugin already infers its default target from that file'
            : !patterns.mappableName.test(fileName)
              ? `the plugin only reads config files named ${patterns.mappableGlob}`
              : undefined;
    if (problem) {
      logger.warn(
        `${pluginName}: ignoring the "${fileName}" entry of configToTargetName because ${problem}.`
      );
      continue;
    }
    targetNames.set(fileName, targetName as string);
  }
  return targetNames;
}

export interface ConfigFileTargets {
  configFile: string;
  isDefault: boolean;
  targetNames: string[];
}

/**
 * Throws when a mapped config file infers a target that another config file in
 * the same project root infers too. Default config files share one target, so
 * they never conflict with each other.
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
