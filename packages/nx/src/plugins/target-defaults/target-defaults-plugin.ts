import { minimatch } from 'minimatch';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
import { readJsonFile } from '../../utils/fileutils';
import { combineGlobPatterns } from '../../utils/globs';
import { NxPluginV2 } from '../../utils/nx-plugin';
import { PackageJson } from '../../utils/package-json';
import { getGlobPatternsFromPackageManagerWorkspaces } from '../package-json-workspaces';

/**
 * This symbol marks that a target provides information which should modify a target already registered
 * on the project via other plugins. If the target has not already been registered, and this symbol is true,
 * the information provided by it will be discarded.
 */
export const ONLY_MODIFIES_EXISTING_TARGET = Symbol(
  'ONLY_MODIFIES_EXISTING_TARGET'
);

export const TargetDefaultsPlugin: NxPluginV2 = {
  name: 'nx/core/target-defaults',
  createNodes: [
    '{package.json,**/package.json,project.json,**/project.json}',
    (configFile, _, ctx) => {
      const fileName = basename(configFile);
      const root = dirname(configFile);

      const packageManagerWorkspacesGlob = combineGlobPatterns(
        getGlobPatternsFromPackageManagerWorkspaces(ctx.workspaceRoot)
      );

      // Only process once if package.json + project.json both exist
      if (
        fileName === 'package.json' &&
        existsSync(join(ctx.workspaceRoot, root, 'project.json'))
      ) {
        return {};
      } else if (
        fileName === 'package.json' &&
        !minimatch(configFile, packageManagerWorkspacesGlob)
      ) {
        return {};
      }

      // If no target defaults, this does nothing
      const targetDefaults = ctx.nxJsonConfiguration?.targetDefaults;
      if (!targetDefaults) {
        return {};
      }

      const projectJson = readJsonOrNull<ProjectConfiguration>(
        join(ctx.workspaceRoot, root, 'project.json')
      );
      const packageJson = readJsonOrNull<PackageJson>(
        join(ctx.workspaceRoot, root, 'package.json')
      );
      const includedScripts = packageJson?.nx?.includedScripts;
      const projectDefinedTargets = new Set([
        ...Object.keys(packageJson?.scripts ?? {}).filter((script) => {
          if (includedScripts) {
            return includedScripts.includes(script);
          }
          return true;
        }),
        ...Object.keys(projectJson?.targets ?? {}),
        ...Object.keys(packageJson?.nx?.targets ?? {}),
      ]);

      const executorToTargetMap = getExecutorToTargetMap(
        packageJson,
        projectJson
      );

      const modifiedTargets: Record<
        string,
        TargetConfiguration & { [ONLY_MODIFIES_EXISTING_TARGET]?: boolean }
      > = {};
      for (const defaultSpecifier in targetDefaults) {
        const targetNames =
          executorToTargetMap.get(defaultSpecifier) ?? new Set();
        targetNames.add(defaultSpecifier);

        for (const targetName of targetNames) {
          // Prevents `build` from overwriting `@nx/js:tsc` if both are present
          // and build is specified later in the ordering.
          if (!modifiedTargets[targetName] || targetName !== defaultSpecifier) {
            const defaults = JSON.parse(
              JSON.stringify(targetDefaults[defaultSpecifier])
            );
            modifiedTargets[targetName] = {
              ...getTargetInfo(targetName, projectJson, packageJson),
              ...defaults,
            };
          }
          // TODO: Remove this after we figure out a way to define new targets
          // in target defaults
          if (!projectDefinedTargets.has(targetName)) {
            modifiedTargets[targetName][ONLY_MODIFIES_EXISTING_TARGET] = true;
          }
        }
      }

      return {
        projects: {
          [root]: {
            targets: modifiedTargets,
          },
        },
      };
    },
  ],
};

function getExecutorToTargetMap(
  packageJson: PackageJson,
  projectJson: ProjectConfiguration
) {
  const executorToTargetMap = new Map<string, Set<string>>();
  const targets = Object.keys({
    ...projectJson?.targets,
    ...packageJson?.scripts,
    ...packageJson?.nx?.targets,
  });
  for (const target of targets) {
    const executor =
      projectJson?.targets?.[target]?.executor ??
      packageJson?.nx?.targets?.[target]?.executor ??
      'nx:run-script';
    const targetsForExecutor = executorToTargetMap.get(executor) ?? new Set();
    targetsForExecutor.add(target);
    executorToTargetMap.set(executor, targetsForExecutor);
  }
  return executorToTargetMap;
}

function readJsonOrNull<T extends Object = any>(path: string) {
  if (existsSync(path)) {
    return readJsonFile<T>(path);
  } else {
    return null;
  }
}

/**
 * This fn gets target info that would make a target uniquely compatible
 * with what is described by project.json or package.json. As the merge process
 * for config happens, without this, the target defaults may be compatible
 * with a config from a plugin and then that combined target be incompatible
 * with the project json configuration resulting in the target default values
 * being scrapped. By adding enough information from the project.json / package.json,
 * we can make sure that the target after merging is compatible with the defined target.
 */
export function getTargetInfo(
  target: string,
  projectJson: Pick<ProjectConfiguration, 'targets'>,
  packageJson: Pick<PackageJson, 'scripts' | 'nx'>
) {
  const projectJsonTarget = projectJson?.targets?.[target];
  const packageJsonTarget = packageJson?.nx?.targets?.[target];

  const executor = getTargetExecutor(target, projectJson, packageJson);
  const targetOptions = {
    ...packageJsonTarget?.options,
    ...projectJsonTarget?.options,
  };

  if (projectJsonTarget?.command) {
    return {
      command: projectJsonTarget?.command,
    };
  }

  if (executor === 'nx:run-commands') {
    if (targetOptions?.command) {
      return {
        executor: 'nx:run-commands',
        options: {
          command: projectJsonTarget.options?.command,
        },
      };
    } else if (targetOptions?.commands) {
      return {
        executor: 'nx:run-commands',
        options: {
          commands: targetOptions.commands,
        },
      };
    }
    return {
      executor: 'nx:run-commands',
    };
  }

  if (executor === 'nx:run-script') {
    return {
      executor: 'nx:run-script',
      options: {
        script: targetOptions?.script ?? target,
      },
    };
  }

  if (executor) {
    return { executor };
  }

  return {};
}

function getTargetExecutor(
  target: string,
  projectJson: Pick<ProjectConfiguration, 'targets'>,
  packageJson: Pick<PackageJson, 'scripts' | 'nx'>
) {
  const projectJsonTarget = projectJson?.targets?.[target];
  const packageJsonTarget = packageJson?.nx?.targets?.[target];
  const packageJsonScript = packageJson?.scripts?.[target];

  if (projectJsonTarget?.command) {
    return 'nx:run-commands';
  }

  if (
    !projectJsonTarget?.executor &&
    !packageJsonTarget?.executor &&
    packageJsonScript
  ) {
    return 'nx:run-script';
  }

  return projectJsonTarget?.executor ?? packageJsonTarget?.executor;
}
