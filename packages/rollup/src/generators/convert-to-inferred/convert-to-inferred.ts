import {
  forEachExecutorOptions,
  NoTargetsToMigrateError,
  findTargetDefault,
} from '@nx/devkit/internal';
import {
  formatFiles,
  getProjects,
  type TargetConfiguration,
  readNxJson,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import type { RollupExecutorOptions } from '../../executors/rollup/schema';
import type { RollupPluginOptions } from '../../plugins/plugin';
import { extractRollupConfigFromExecutorOptions } from './lib/extract-rollup-config-from-executor-options';
import { addPluginRegistrations } from './lib/add-plugin-registrations';
import { assertSupportedRollupVersion } from '../../utils/versions';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  assertSupportedRollupVersion(tree);

  const migratedProjects = new Map<string, RollupPluginOptions>();
  let projects = getProjects(tree);

  forEachExecutorOptions<RollupExecutorOptions>(
    tree,
    '@nx/rollup:rollup',
    (_, projectName, targetName, configurationName) => {
      if (options.project && projectName !== options.project) return;

      const project = projects.get(projectName);
      const target = project?.targets?.[targetName];
      if (!project?.targets || !target) return;

      // We'll handle configurations when dealing with default options.
      if (configurationName) return;

      // Since targetDefaults for '@nx/rollup:rollup' will no longer apply, we want to copy them to the target options.
      const nxJson = readNxJson(tree);
      const defaults = findTargetDefault(nxJson?.targetDefaults, {
        executor: '@nx/rollup:rollup',
      });
      if (defaults) {
        const {
          target: _t,
          executor: _e,
          projects: _p,
          plugin: _pl,
          ...rest
        } = defaults;
        for (const [key, value] of Object.entries(rest)) {
          (target as Record<string, unknown>)[key] ??= value;
        }
      }

      const extractedPluginOptions = extractRollupConfigFromExecutorOptions(
        tree,
        target.options,
        target.configurations,
        project.root
      );

      // If rollup is not an external dependency, add it
      if (
        target.inputs &&
        !target.inputs.some(
          (i) =>
            hasExternalDependencies(i) &&
            i.externalDependencies.includes('rollup')
        )
      ) {
        const existing = target.inputs.find(hasExternalDependencies);
        if (existing) {
          existing.externalDependencies.push('rollup');
        } else {
          target.inputs.push({ externalDependencies: ['rollup'] });
        }
      }

      // Clean up the target now that it is inferred
      delete target.executor;
      if (
        target.outputs &&
        target.outputs.length === 1 &&
        // "{projectRoot}/{options.outputPath}" is an invalid output for Rollup since
        // there would be a mismatch between where the executor outputs to and where Nx caches.
        // If users have this set erroneously, then it will continue to not work.
        (target.outputs[0] === '{options.outputPath}' ||
          target.outputs[0] === '{workspaceRoot}/{options.outputPath}')
      ) {
        // If only the default `options.outputPath` is set as output, remove it and use path inferred from `rollup.config.cjs`.
        delete target.outputs;
      } else if (target.outputs) {
        // Otherwise, replace `options.outputPath` with what is inferred from `rollup.config.cjs`.
        target.outputs = target.outputs.map((output) =>
          // Again, "{projectRoot}/{options.outputPath}" is an invalid output for Rollup.
          output === '{options.outputPath}' ||
          output === '{workspaceRoot}/{options.outputPath}'
            ? `{projectRoot}/${extractedPluginOptions.outputPath}`
            : output
        );
      }
      if (Object.keys(target.options).length === 0) delete target.options;
      if (Object.keys(target).length === 0) delete project.targets[targetName];

      updateProjectConfiguration(tree, projectName, project);

      migratedProjects.set(projectName, { buildTargetName: targetName });
    }
  );

  if (migratedProjects.size === 0) {
    throw new NoTargetsToMigrateError();
  }

  projects = getProjects(tree);
  await addPluginRegistrations<RollupPluginOptions>(
    tree,
    migratedProjects,
    projects,
    '@nx/rollup/plugin'
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function hasExternalDependencies(
  input: NonNullable<TargetConfiguration['inputs']>[number]
): input is { externalDependencies: string[] } {
  return (
    typeof input === 'object' &&
    'externalDependencies' in input &&
    Array.isArray(input.externalDependencies)
  );
}

export default convertToInferred;
