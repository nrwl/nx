import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../src/config/workspace-json-project-json';
import { toProjectName } from '../src/config/workspaces';
import { readJsonFile } from '../src/utils/fileutils';
import { NxPluginV2 } from '../src/utils/nx-plugin';
import {
  PackageJson,
  readTargetsFromPackageJson,
} from '../src/utils/package-json';

export function getNxProjectJsonPlugin(root: string): NxPluginV2 {
  return {
    name: 'nx-core-build-project-json-nodes',
    createNodes: [
      '{project.json,**/project.json}',
      (file) => {
        const json = readJsonFile<ProjectConfiguration>(join(root, file));
        const project = buildProjectFromProjectJson(json, file);
        mergePackageJsonConfigurationWithProjectJson(project, root);
        return {
          projects: {
            [project.name]: project,
          },
        };
      },
    ],
  };
}

export function buildProjectFromProjectJson(
  json: Partial<ProjectConfiguration>,
  path: string
): ProjectConfiguration {
  return {
    name: toProjectName(path),
    root: dirname(path),
    ...json,
  };
}

export function mergePackageJsonConfigurationWithProjectJson(
  p: ProjectConfiguration,
  root: string
) {
  if (existsSync(join(root, p.root, 'package.json'))) {
    try {
      const packageJson: PackageJson = readJsonFile(
        join(root, p.root, 'package.json')
      );

      p.targets = mergeNpmScriptsWithTargets(packageJson, p.targets);

      const { nx } = packageJson;

      if (nx?.tags) {
        p.tags = [...(p.tags || []), ...nx.tags];
      }
      if (nx?.implicitDependencies) {
        p.implicitDependencies = [
          ...(p.implicitDependencies || []),
          ...nx.implicitDependencies,
        ];
      }
      if (nx?.namedInputs) {
        p.namedInputs = { ...(p.namedInputs || {}), ...nx.namedInputs };
      }
    } catch (e) {
      // ignore json parser errors
    }
  }
}

export function mergeNpmScriptsWithTargets(
  packageJson: PackageJson,
  targets: Record<string, TargetConfiguration>
): Record<string, TargetConfiguration> {
  try {
    return { ...readTargetsFromPackageJson(packageJson), ...(targets || {}) };
  } catch (e) {
    return targets;
  }
}
