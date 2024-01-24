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
      const projectDefinedTargets = new Set(
        Object.keys({
          ...packageJson?.scripts,
          ...projectJson?.targets,
        })
      );

      const executorToTargetMap = getExecutorToTargetMap(
        packageJson,
        projectJson
      );

      const newTargets: Record<
        string,
        TargetConfiguration & { [ONLY_MODIFIES_EXISTING_TARGET]?: boolean }
      > = {};
      for (const defaultSpecifier in targetDefaults) {
        const targetName =
          executorToTargetMap.get(defaultSpecifier) ?? defaultSpecifier;
        newTargets[targetName] = structuredClone(
          targetDefaults[defaultSpecifier]
        );
        // TODO: Remove this after we figure out a way to define new targets
        // in target defaults
        if (!projectDefinedTargets.has(targetName)) {
          newTargets[targetName][ONLY_MODIFIES_EXISTING_TARGET] = true;
        }
      }

      return {
        projects: {
          [root]: {
            targets: newTargets,
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
  const executorToTargetMap = new Map<string, string>();
  if (packageJson?.scripts) {
    for (const script in packageJson.scripts) {
      executorToTargetMap.set('nx:run-script', script);
    }
  }
  if (projectJson?.targets) {
    for (const target in projectJson.targets) {
      if (projectJson.targets[target].executor) {
        executorToTargetMap.set(projectJson.targets[target].executor, target);
      } else if (projectJson.targets[target].command) {
        executorToTargetMap.set('nx:run-commands', target);
      }
    }
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
