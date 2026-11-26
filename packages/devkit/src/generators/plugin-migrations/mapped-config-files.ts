import { posix } from 'node:path';
import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from 'nx/src/devkit-exports';
import type { ConfigFileNamePatterns } from '../../utils/config-files';

export interface MappableConfigOption {
  executors: string[];
  /** The executor option naming the config file, e.g. `jestConfig`. */
  option: string;
  patterns: ConfigFileNamePatterns;
  /** Whether a default config in the project root infers the `test` target. */
  infersDefaultTarget(tree: Tree, projectRoot: string): boolean;
}

/**
 * The file name to map to the target in the plugin's `configFiles` option, or
 * undefined when the plugin cannot infer the target that way.
 */
export function mappedConfigFileName(
  tree: Tree,
  target: TargetConfiguration,
  project: ProjectConfiguration,
  targetName: string,
  config: MappableConfigOption
): string | undefined {
  const configFile = target.options?.[config.option];
  if (typeof configFile !== 'string') {
    return undefined;
  }
  const path = posix.normalize(configFile);
  const fileName = posix.basename(path);
  if (
    posix.dirname(path) !== posix.normalize(project.root) ||
    config.patterns.defaultName.test(fileName) ||
    !config.patterns.mappableName.test(fileName) ||
    !tree.exists(path)
  ) {
    return undefined;
  }
  // The inferred command names the config, so a configuration can't switch it
  const switchesConfig = Object.values(target.configurations ?? {}).some(
    (configuration) => {
      const configured = configuration[config.option];
      return configured !== undefined && posix.normalize(configured) !== path;
    }
  );
  // The registration's default target name infers `test` from the default config
  const collidesWithDefault =
    targetName === 'test' && config.infersDefaultTarget(tree, project.root);
  if (
    switchesConfig ||
    collidesWithDefault ||
    isClaimedByEarlierTarget(project, targetName, path, config)
  ) {
    return undefined;
  }
  return fileName;
}

/**
 * The normalized path of a config option value without a default config name.
 * The converter receives one only when `configFiles` infers it, and the
 * inferred command already passes it.
 */
export function toMappedConfigPath(
  configFile: unknown,
  patterns: ConfigFileNamePatterns
): string | undefined {
  if (typeof configFile !== 'string') {
    return undefined;
  }
  const path = posix.normalize(configFile);
  return patterns.defaultName.test(posix.basename(path)) ? undefined : path;
}

// configFiles maps each config file to one target
function isClaimedByEarlierTarget(
  project: ProjectConfiguration,
  targetName: string,
  path: string,
  config: MappableConfigOption
): boolean {
  for (const [name, target] of Object.entries(project.targets ?? {})) {
    if (name === targetName) {
      return false;
    }
    const configFile = target.options?.[config.option];
    if (
      config.executors.includes(target.executor) &&
      typeof configFile === 'string' &&
      posix.normalize(
        configFile
          .replace('{workspaceRoot}/', '')
          .replace('{projectRoot}', project.root)
      ) === path
    ) {
      return true;
    }
  }
  return false;
}
