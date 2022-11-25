import { join } from 'path';
import { existsSync } from 'fs';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  loadNxPlugins,
  mergePluginTargetsWithNxTargets,
} from '../../utils/nx-plugin';
import { ProjectGraphProcessorContext } from '../../config/project-graph';
import { mergeNpmScriptsWithTargets } from '../../utils/project-graph-utils';
import { ProjectGraphBuilder } from '../project-graph-builder';
import { PackageJson } from '../../utils/package-json';
import { readJsonFile } from '../../utils/fileutils';
import { NxJsonConfiguration } from '../../config/nx-json';
import { TargetConfiguration } from '../../config/workspace-json-project-json';
import { NX_PREFIX } from '../../utils/logger';

export function buildWorkspaceProjectNodes(
  ctx: ProjectGraphProcessorContext,
  builder: ProjectGraphBuilder,
  nxJson: NxJsonConfiguration
) {
  const toAdd = [];
  Object.keys(ctx.workspace.projects).forEach((key) => {
    const p = ctx.workspace.projects[key];
    const projectRoot = join(workspaceRoot, p.root);
    if (existsSync(join(projectRoot, 'package.json'))) {
      p.targets = mergeNpmScriptsWithTargets(projectRoot, p.targets);

      const { nx }: PackageJson = readJsonFile(
        join(projectRoot, 'package.json')
      );
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
    }

    p.targets = normalizeProjectTargets(p.targets, nxJson.targetDefaults, key);

    p.targets = mergePluginTargetsWithNxTargets(
      p.root,
      p.targets,
      loadNxPlugins(ctx.workspace.plugins)
    );

    // TODO: remove in v16
    const projectType =
      p.projectType === 'application'
        ? key.endsWith('-e2e') || key === 'e2e'
          ? 'e2e'
          : 'app'
        : 'lib';
    const tags =
      ctx.workspace.projects && ctx.workspace.projects[key]
        ? ctx.workspace.projects[key].tags || []
        : [];

    toAdd.push({
      name: key,
      type: projectType,
      data: {
        ...p,
        tags,
        files: ctx.fileMap[key],
      },
    });
  });

  // Sort by root directory length (do we need this?)
  toAdd.sort((a, b) => {
    if (!a.data.root) return -1;
    if (!b.data.root) return -1;
    return a.data.root.length > b.data.root.length ? -1 : 1;
  });

  toAdd.forEach((n) => {
    builder.addNode({
      name: n.name,
      type: n.type,
      data: n.data,
    });
  });
}

/**
 * Apply target defaults and normalization
 */
function normalizeProjectTargets(
  targets: Record<string, TargetConfiguration>,
  defaultTargets: NxJsonConfiguration['targetDefaults'],
  projectName: string
) {
  for (const targetName in defaultTargets) {
    const target = targets?.[targetName];
    if (!target) {
      continue;
    }
    if (defaultTargets[targetName].inputs && !target.inputs) {
      target.inputs = defaultTargets[targetName].inputs;
    }
    if (defaultTargets[targetName].dependsOn && !target.dependsOn) {
      target.dependsOn = defaultTargets[targetName].dependsOn;
    }
    if (defaultTargets[targetName].outputs && !target.outputs) {
      target.outputs = defaultTargets[targetName].outputs;
    }
  }
  for (const target in targets) {
    const config = targets[target];
    if (config.command) {
      if (config.executor) {
        throw new Error(
          `${NX_PREFIX} ${projectName}: ${target} should not have executor and command both configured.`
        );
      } else {
        targets[target] = {
          ...targets[target],
          executor: 'nx:run-commands',
          options: {
            ...config.options,
            command: config.command,
          },
        };
      }
    }
  }
  return targets;
}
